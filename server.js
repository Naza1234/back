const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all origins
app.use(cors());

// Create folders if missing
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('converted')) fs.mkdirSync('converted');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-input.webm`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only accept .webm files
    if (file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .webm files are allowed.'));
    }
  }
});

app.post('/convert', upload.single('video'), (req, res) => {
  const inputPath = path.join(__dirname, 'uploads', req.file.filename);
  const outputFilename = `${Date.now()}-output.mp4`;
  const outputPath = path.join(__dirname, 'converted', outputFilename);

  // Set headers first before doing any processing or streaming
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename=${outputFilename}`);

  // Convert the video using ffmpeg
  ffmpeg(inputPath)
    .outputOptions(['-c:v libx264', '-c:a aac'])
    .on('end', () => {
      // After the conversion ends, create the stream and pipe to the response
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);

      // Cleanup temp files after response is finished
      readStream.on('close', () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', err => {
      console.error('FFmpeg error:', err);
      res.status(500).send('Video conversion failed.');
    })
    .save(outputPath);  // Save the converted video to outputPath
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
