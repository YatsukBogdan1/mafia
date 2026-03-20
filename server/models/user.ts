import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  password: string;
  displayName: string;
  mediaPrefs: { camera: boolean; mic: boolean };
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, trim: true, default: '' },
    mediaPrefs: {
      camera: { type: Boolean, default: true },
      mic: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);
