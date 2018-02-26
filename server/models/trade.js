import mongoose from 'mongoose';
import { infelicity } from '../routes/api';

const tradesSchema = mongoose.Schema({
    pair: String,
    buyPrice: Number,
    interval: String,
    session: String,
    closePrice: Number,
    localMin: {
        position: Number,
        price: Number
    },
    comments: String,
    takeProfit: Number,
    buyLimit: Number,
    createdAt: {
        type: Date
    }
});

export default mongoose.model('trade', tradesSchema);