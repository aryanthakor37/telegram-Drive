import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    color: {
      type: String,
      default: '#cbd5e1' // default slate-300 color
    }
  },
  {
    timestamps: true
  }
);

const Folder = mongoose.model('Folder', folderSchema);

export default Folder;
