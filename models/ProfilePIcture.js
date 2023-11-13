const mongoose = require('mongoose');

const profilePictureSchema = new mongoose.Schema({
  filename: String,
  user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Replace 'User' with the actual model name for your users
  },
});

const ProfilePicture = mongoose.model('ProfilePicture', profilePictureSchema, 'user_pfps');

module.exports = ProfilePicture;

