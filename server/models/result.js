import mongoose from 'mongoose';
import { infelicity } from '../routes/api';

const resultSchema = mongoose.Schema({
    pair: String,
    buyDate: Date,
    result: Number
});

export default mongoose.model('result', resultSchema);