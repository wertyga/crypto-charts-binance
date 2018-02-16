import mongoose from 'mongoose';
import { infelicity } from '../routes/api';

const resultSchema = mongoose.Schema({
    pair: String,
    buyDate: Date,
    result: String
});

export default mongoose.model('result', resultSchema);