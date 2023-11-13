const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const bcrypt = require('bcrypt');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const ProfilePicture = require('./models/ProfilePicture');
const User = require('./models/User');

require('dotenv').config();

const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Specify the upload destination folder
  },
  filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });



// Passport.js Configuration
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await User.findOne({ username });
    if (!user) {
      return done(null, false, { message: 'User not found' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return done(null, false, { message: 'Incorrect password' });
    }
    return done(null, user);
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});


// Replace with your Deezer App ID and Secret Key
const APP_ID = 'YOUR_APP_ID';
const SECRET_KEY = 'YOUR_SECRET_KEY';

// Define the Deezer API endpoint for trending songs
const TRENDING_API_URL = 'https://api.deezer.com/playlist/3155776842';

// Make a GET request to the API with authentication
axios.get(TRENDING_API_URL, {
  params: {
    app_id: APP_ID,
    secret: SECRET_KEY,
  },
})
  .then(response => {
    const trendingSongs = response.data.tracks.data;
    // You can now display the trending songs on your homepage
  })
  .catch(error => {
    console.error('Error fetching trending songs:', error);
  });


app.post('/register', async (req, res) => {
  const { username, password, email, profilePictureURL } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = new User({
    username,
    email,
    password: hashedPassword,
    profilePictureURL, // Save the profile picture URL
  });

  try {
    await user.save();
    res.redirect('/index.html'); // Redirect to the login page
  } catch (error) {
    res.status(500).send('An error occurred during registration');
  }
});


app.post('/login', (req, res, next) => {
  console.log('Received a login request');
  passport.authenticate('local', {
    successRedirect: 'homepage',
    failureRedirect: '/index.html',
    failureFlash: true,
  })(req, res, next);
});

// In your Node.js code
app.get('/homepage', async (req, res) => {
  try {
      // Make a request to Deezer's API to get trending songs
      const response = await axios.get('https://api.deezer.com/chart/0/tracks'); // You may need to adjust the URL according to Deezer's API documentation

      // Extract the trending songs data from the response
      const trendingSongs = response.data.data;

      // Render your homepage template and pass the trendingSongs data
      res.render('homepage', { trendingSongs });
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred while fetching trending songs.');
  }
});


app.get('/profile', (req, res) => {
  // Check if the user is authenticated
  if (req.isAuthenticated()) {
    // Pass the user object to the template
    res.render('profile', { user: req.user, userName: req.user.username });
  } else {
    // Redirect to the login page if not authenticated
    res.redirect('/index.html');
  }
});


// Render the search page
// Handle the search form submission
app.post('/search', async (req, res) => {
  try {
    const query = req.body.query;

    // Replace YOUR_APP_ID and YOUR_SECRET_KEY with your Deezer application ID and secret key
    const APP_ID = process.env.YOUR_APP_ID;
    const SECRET_KEY = process.env.YOUR_SECRET_KEY;
    const DEEZER_AUTH_ENDPOINT = 'https://connect.deezer.com/oauth/access_token.php';

    // Make a POST request to obtain an access token
    const response = await axios.post(DEEZER_AUTH_ENDPOINT, null, {
      params: {
        app_id: APP_ID,
        secret: SECRET_KEY,
        output: 'json',
      },
    });

    const accessToken = response.data.access_token;

    // Now, you can use the obtained access token to make authenticated requests to the Deezer API.
    // Make your API request using the access token and handle the response.

    // Example API request:
    const DEEZER_API_ENDPOINT = 'https://api.deezer.com/search';
    const apiResponse = await axios.get(`${DEEZER_API_ENDPOINT}?q=${query}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Extract search results from the API response
    const searchResults = apiResponse.data.data.map(result => {
      return {
        audioUrl: result.preview, // Get the audio URL from the API response
        artist: { name: result.artist.name }, // Get the artist name
        title: result.title, // Get the title
        album: { cover_medium: result.album.cover_medium }, // Get the album cover
      };
    });

    // Render the search results template and pass the searchResults data
    res.render('search-results', { searchResults });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while searching for music.');
  }
});

app.post('/upload', upload.single('profilePicture'), (req, res) => {
  if (req.file) {
    const userId = req.user._id;

    // Add this log to check the userId
    console.log('Current User ID:', userId);

    // Find the user's existing profile picture, if any
    ProfilePicture.findOne({ user: userId })
      .then((existingPicture) => {
        // Add this log to check the existingPicture
        console.log('Existing Picture:', existingPicture);

        // Delete old profile picture files that don't match the current user
        ProfilePicture.find({ user: userId, filename: { $ne: req.file.filename } })
          .then((oldPictures) => {
            // Add this log to check the oldPictures
            console.log('Old Pictures:', oldPictures);

            oldPictures.forEach((oldPicture) => {
              const oldFilePath = path.join(__dirname, 'uploads', oldPicture.filename);
              fs.unlink(oldFilePath, (err) => {
                if (err) {
                  console.error('Error deleting old profile picture file:', err);
                } else {
                  console.log('Old profile picture file deleted successfully:', oldPicture.filename);
                }
              });
            });
          })
          .catch((err) => {
            console.error('Error finding old profile pictures:', err);
          });

        if (existingPicture) {
          // If an existing picture is found, update it with the new file
          existingPicture.filename = req.file.filename;
          existingPicture.save()
            .then(() => {
              // Redirect to the profile page with a success message
              res.redirect('/profile?success=Profile%20picture%20updated%20successfully');
            })
            .catch((err) => {
              // Render an error page with a message
              res.status(500).render('error', { message: 'Error updating profile picture in the database' });
            });
        } else {
          // If no existing picture is found, create a new profile picture entry
          const profilePicture = new ProfilePicture({
            filename: req.file.filename,
            user: userId,
          });
          profilePicture.save()
            .then(() => {
              // Redirect to the profile page with a success message
              res.redirect('/profile?success=Profile%20picture%20uploaded%20successfully');
            })
            .catch((err) => {
              // Render an error page with a message
              res.status(500).render('error', { message: 'Error saving profile picture to the database' });
            });
        }
      })
      .catch((err) => {
        // Render an error page with a message
        res.status(500).render('error', { message: 'Error finding existing profile picture in the database' });
      });
  } else {
    // Render an error page with a message
    res.status(400).render('error', { message: 'No file uploaded' });
  }
});


app.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;

  // Find the user's profile picture based on the user's ID
  ProfilePicture.findOne({ user: userId })
      .then((profilePicture) => {
          if (profilePicture) {
              // Serve the profile picture's file using its filename
              res.sendFile(path.join(__dirname, 'uploads', profilePicture.filename));
          } else {
              // Provide a default profile picture or handle the case where no profile picture is found
              res.sendFile(path.join(__dirname, '/public/img/profile-user.png'));
          }
      })
      .catch((err) => {
          res.status(500).json({ error: 'Error retrieving profile picture' });
      });
});

// Route to get a user's pfp
router.get('/:user_id', async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const pfp = await ProfilePicture.findOne({ user_id });
    res.json(pfp);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error retrieving pfp');
  }
});




// Define a route for logging out
app.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      // Handle the error, if any.
      console.error(err);
    }
    res.redirect('/index.html'); // Redirect to the home page or any other page you prefer.
  });
});

module.exports = app;
