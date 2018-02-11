import axios from 'axios';

function analyzeData(signalMACD) {
    // Get pairs
    axios({
        url: baseUrl + '/api/v1/exchangeInfo',
        method: 'get'
    })
        .then(resp => {
            const pairs = resp.data.symbols;

            console.log(pairs)
        })
        .catch(err => { throw err })
};