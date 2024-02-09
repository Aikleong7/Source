const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const upload = require('../config/uploadimg');
const passport = require("passport");
const AWS = require('aws-sdk');

// AWS.config.update({ region:process.env.AWS_REGION ,
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   sessionToken: process.env.AWS_SESSION_TOKEN
// });
AWS.config.update({ region:"us-east-1"});

const rekognition = new AWS.Rekognition();
const sns = new AWS.SNS();
const secretManager = new AWS.SecretsManager(); 
const secretName = 'MySecret';
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const getSecretValue = async () => {
  try {
    const secretData = await secretManager.getSecretValue({ SecretId: secretName }).promise();
    // const secretValue = await JSON.parse(secretData.SecretString);
    // Use the secret value here
    return secretData.SecretString;
  } catch (error) {
    console.error(error);
    // Handle error
  }
};
// GET request to render the login page
router.get('/', async (req, res) => {
 
    res.render('home'); // Assuming you have a view engine set up to render the login page
});
router.get('/form', (req, res) => {
    res.render('form'); // Assuming you have a view engine set up to render the login page
});
router.get("/test", async(req, res) => {
  const searchParams = { TableName: 'cad-assignment-user', FilterExpression: 'category = :category', ExpressionAttributeValues: { ':category': "123123" } }; 
  const searchResult = await dynamodb.scan(searchParams).promise(); 
  console.log(searchResult.Items); // Do something with the search result

});

// POST request to handle form submission
router.post('/form', upload.single("file"), async (req, res) => {
    const { name, description, category } = req.body;
    const id = crypto.randomUUID();
    const key = id + ".png";
    const bucket = await getSecretValue();
    // console.log(req.body)
    const image = req.file; // Assuming you have middleware set up to handle file uploads
    const params = {
        Bucket: bucket,
        Key: key,
        Body: image.buffer,
        ContentType: image.mimetype
    }
    const recogparams = {
      Image: {
          S3Object: {
              Bucket: bucket,
              Name: key
          }
      },
      MaxLabels: 10 // Maximum number of labels to return
  };

  
    try { 
      
      await s3.upload(params).promise();
      rekognition.detectLabels(recogparams, async (err, data) => {
        if (err) {
            console.log('Error:', err);
        } else {
          const searchParams = { TableName: 'cad-assignment-user', FilterExpression: 'category = :category', ExpressionAttributeValues: { ':category': String(category) } }; 
          const searchResult = await dynamodb.scan(searchParams).promise(); 
          for (const item of searchResult.Items) {
            const publishParams = {
              Message: 'Hello, relevant category have new item found!',
              Subject: 'Notification',
              TopicArn: item.topicArn
            };
            await sns.publish(publishParams).promise();
          } 

            const label = data.Labels[0]["Categories"][0]["Name"]
            const dynamodbparams = { 
              TableName: 'cad-assignment-table', Item: { id: id, name: name, description: description, category: label } };
            await dynamodb.put(dynamodbparams).promise();
        }
    });
    
      res.redirect('/list'); 
    } catch (error) { 
      console.error(error); 
      res.status(500).send('Error writing data to DynamoDB or uploading file to S3'); 
    }
});
router.get('/list', async (req, res) => {
  const params = { TableName: 'cad-assignment-table' };
  try {
    const data = await dynamodb.scan(params).promise();
    res.render('list', { items: data.Items });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error reading data from DynamoDB');
  }
});
router.get('/list/:id', async (req, res) => {
  const params = { TableName: 'cad-assignment-table', Key: { id: req.params.id } };
  const randomNum = Math.floor(Math.random() * 1000)
  const bucket = await getSecretValue();
  try {
    const data = await dynamodb.get(params).promise();
    res.render('detail', { item: data.Item, addNumbersToSrc: randomNum, bucket: bucket});
  } catch (error) {
    console.error(error);
    res.status(500).send('Error reading data from DynamoDB');
  }
});
router.get('/delete/:id', async (req, res) => {
  const params = { TableName: 'cad-assignment-table', Key: { id: req.params.id } };
  try {
    await dynamodb.delete(params).promise();
    res.redirect('/list');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting data from DynamoDB');
  }
});
router.get('/update/:id', async (req, res) => {
  const params = { TableName: 'cad-assignment-table', Key: { id: req.params.id } };
  try {
    const data = await dynamodb.get(params).promise();
    res.render('update', { item: data.Item });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error reading data from DynamoDB');
  }
});
router.post('/update/:id',upload.single("file"), async (req, res) => {
  const { name, description, category } = req.body;
  const image = req.file; // Assuming you have middleware set up to handle file uploads
  const params = { TableName: 'cad-assignment-table', Key: { id: req.params.id }, UpdateExpression: 'set #n = :n, description = :d, category = :c', ExpressionAttributeNames: { '#n': 'name' }, ExpressionAttributeValues: { ':n': name, ':d': description, ':c': category } };
  const key = req.params.id  + ".png";
  const bucket = await getSecretValue();
  const s3params = {
      Bucket: bucket,
      Key: key,
      Body: image.buffer,
      ContentType: image.mimetype
  }
  try {
    await s3.upload(s3params).promise();
    await dynamodb.update(params).promise();
    res.redirect('/list');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating data in DynamoDB');
  }
});
router.get('/search', async (req, res) => {
  const { query } = req.query;
  const params = {
    TableName: 'cad-assignment-table',
    FilterExpression: 'contains(#n, :query) or contains(description, :query) or contains(category, :query)',
    ExpressionAttributeNames: { '#n': 'name' },
    ExpressionAttributeValues: { ':query': query }
  };
  try {
    const data = await dynamodb.scan(params).promise();
    res.render('list', { items: data.Items, query });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error searching data in DynamoDB');
  }
});

// Export the router so it can be mounted in the main app


router.get('/notification', async (req, res) => {
  res.render('notification');
});
router.post('/notification', async (req, res) => {
  const { email, category } = req.body;
  const id = crypto.randomUUID()
  const topicParams = {
    Name: id
  };
  try {
    const topicData = await sns.createTopic(topicParams).promise();
    const topicArn = topicData.TopicArn;
    const subscribeParams = {
      Protocol: 'email',
      TopicArn: topicArn,
      Endpoint: email
    };
    await sns.subscribe(subscribeParams).promise();
    const dynamodbParams = {
      TableName: 'cad-assignment-user',
      Item: {
      id: id,
      topicArn: topicArn,
      email: email,
      category: category,
      }
    };
    await dynamodb.put(dynamodbParams).promise();
    res.send('Notification sent successfully!');
  }
  catch (error) {
    console.error(error);
    res.status(500).send('Error creating notisubscription or writing data to DynamoDB');
  }

  }
);


module.exports = router;
