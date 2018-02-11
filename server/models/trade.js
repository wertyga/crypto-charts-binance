import mongoose from 'mongoose';
import { infelicity } from '../routes/api';

const tradesSchema = mongoose.Schema({
    pair: String,
    buyPrice: Number,
    interval: String,
    currentPrice: Number,
    closePrice: Number,
    createdAt: {
        type: Date
    }
});

export default mongoose.model('trade', tradesSchema);