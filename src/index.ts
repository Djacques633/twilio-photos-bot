require('dotenv').config();

import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const bearerToken = process.env.GOOGLE_OAUTH_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER;
const client = twilio(accountSid,authToken);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());
let albumId = "";
let headers = {
  'Content-type': 'application/json',
  'Authorization': 'Bearer ' + bearerToken
} 
let albumCreated: boolean = false;
const createNewAlbum = async (): Promise<void> => {
  const x = await axios.post('https://photoslibrary.googleapis.com/v1/albums', {
    "album": {
      "isWriteable": true,
      "id": "",
      "title": "Shared Google ALbum"
    }
  }, {headers:headers});
  albumCreated = true;
  albumId = x.data.id;
}

app.post('/sms', async (req: any, res: any) => {
  console.log("Uploading...")
  console.log(req.body);
  try {

    if (!albumCreated) {
      await createNewAlbum();
    }
    const { body } = req;

    const { NumMedia, From: SenderNumber, MessageSid } = body;
    for (var i = 0; i < NumMedia; i++) {
      let mediaUrl: string = body[`MediaUrl${i}`];
      console.log(mediaUrl);
      const image = await axios.request({method: 'GET',
        url: mediaUrl,
        responseType: 'arraybuffer',
        // @ts-ignore
        responseEncoding: 'binary'
      }
      );
      let url = 'https://photoslibrary.googleapis.com/v1/uploads';
      const bin = new Buffer(image.data).toString('binary');
      let config2 = {
        'headers': {
          'X-Goog-Upload-Protocol': 'raw',
          'Content-Type': 'application/octet-stream',
          'Authorization': 'Bearer ' + bearerToken,
        }
      };

        let r = await axios.post(url, image.data, {headers: config2.headers});     
        let reqBody = {
          'albumId': albumId,
          'newMediaItems': [
            {
              'description': (new Date()).toString(),
              'simpleMediaItem': {
                'uploadToken': r.data,
              }
            }],
        };
        let response = await axios.post('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', reqBody, {headers:headers});
        console.log(response);
    }
    client.messages
    .create({
       body: `${NumMedia} picture${NumMedia > 0 ? "s" : ""} uploaded!`,
       from: twilioNumber,
       to: SenderNumber
     })
  }
  catch(err) {
    console.log(err);
  }

  res.end();

});



http.createServer(app).listen(1337, async () => {
  console.log('Express server listening on port 1337');
});