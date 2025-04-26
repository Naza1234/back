const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // Make PORT flexible for deployment

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .webm files are allowed.'));
    }
  }
});

app.post('/convert', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const inputPath = path.join(__dirname, 'uploads', req.file.filename);
  const outputFilename = `${Date.now()}-output.mp4`;
  const outputPath = path.join(__dirname, 'converted', outputFilename);

  // Convert the video using ffmpeg
  ffmpeg(inputPath)
    .outputOptions([
      '-c:v libx264', 
      '-c:a aac',
      '-preset veryfast', // Faster compression
      '-crf 28',           // Lower quality, smaller size
      '-movflags +faststart' // Optimized for streaming
    ])
    .on('end', () => {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
      
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);

      readStream.on('close', () => {
        // Cleanup temp files after sending
        fs.unlink(inputPath, (err) => {
          if (err) console.error('Failed to delete input file:', err);
        });
        fs.unlink(outputPath, (err) => {
          if (err) console.error('Failed to delete output file:', err);
        });
      });
    })
    .on('error', err => {
      console.error('FFmpeg error:', err);
      res.status(500).send('Video conversion failed.');

      // Clean up input if FFmpeg fails
      fs.unlink(inputPath, (unlinkErr) => {
        if (unlinkErr) console.error('Failed to delete input after ffmpeg error:', unlinkErr);
      });
    })
    .save(outputPath);
});

// Handle Multer file size errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('File too large. Max size is 10MB.');
    }
  } else if (err) {
    return res.status(400).send(err.message);
  }
  next();
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
