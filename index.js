const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");

const bodyParser = require("body-parser");
// To laod environment variables
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const Video = require("./video");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const uri = process.env.URI;

mongoose
  .connect(uri)
  .then(() => console.log("Connected"))
  .catch((error) => console.log("error"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage }).single("video");

const { exec } = require("node:child_process");
const { log } = require("console");

app.get("/", (req, res) => {
  res.send("MPD generator");
});

app.get("/getVideos", async (req, res) => {
  const videoList = await Video.find();
  if (!videoList) {
    res.status(500).json({
      success: false,
    });
  }
  res.send(videoList);
});

app.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    console.log(req.body);
    const vidRecordObj = {
      title: req.body.title,
      description: req.body.description,
    };
    const video = new Video(vidRecordObj);
    var fileid;

    fileid = (await video.save())._id.toString();

    const file = req.file.filename;
    if (err) {
      console.log("Error while uploading");
    }

    let filename = file.split(".")[0];
    const folderName = `streamlets/${fileid}`;
    try {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
    } catch (err) {
      console.error(err);
    }

    filename = filename.split(".")[0];
    let aspectsetting = `ffmpeg -y -i ./uploads/${filename}.mp4 -aspect 16:9 -c copy ./uploads/updated/${filename}.mp4`;
    let cmd = `ffmpeg -re -i ./uploads/updated/${filename}.mp4 -map 0 -map 0 -map 0 -c:a aac -c:v libx264 -b:v:1 20000k -b:v:2 20000k -b:v:2 20000k -s:v:0 1920x1080 -s:v:1 1280x720 -s:v:2 720x480 -profile:v:1 baseline -profile:v:2 baseline -profile:v:0 main -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 -b_strategy 0 -ar:a:1 22050 -use_timeline 1 -use_template 1 -adaptation_sets "id=0,streams=v id=1,streams=a" -f dash ./streamlets/${fileid}/${fileid}_out.mpd`;

    exec(aspectsetting, (err, output) => {
      if (err) {
        console.error("could not execute command: ", err);
        res.status(400).end();
        return
      }
      exec(cmd, (err, output) => {
        if (err) {
          console.error("could not execute command: ", err);
          res.status(400).end();
          return;
        }

        console.log("Mpd file has been generated");
        res.status(200).send("Success");
      });
    });
  });
});

app.listen(4000, () => {
  console.log(`Listening on http://localhost:4000`);
});
