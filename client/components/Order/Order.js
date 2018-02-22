import axios from 'axios';
import { connect } from 'react-redux';
import io from 'socket.io-client';

import { closeOrder } from '../../actions/pairsAPI';

import { exponentialMovingAverage, signalMACD, macdCalculate, simpleMA } from '../../../server/common/ema';

import Depth from '../Depth/Depth';

import './Order.sass';


@connect(null, { closeOrder })
export default class Order extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            pair: this.props.pair || '',
            buyPrice: this.props.buyPrice || '',
            currentPrice: this.props.currentPrice || '',
            interval: this.props.interval || '',
            loading: false,
            data: [],
            error: '',
            buyDate: this.props.createdAt,
            buyed: false,
            profit: '',
            closePrice: this.props.closePrice,
            buyDepth: 0,
            sellDepth: 0
        };
    };

    componentDidMount() {
        this.socket = io(`/`);
        this.socket.on(`kline-${this.state.pair}`, msg => {
            this.setState({
                currentPrice: +JSON.parse(msg).k.c
            });
        });
        this.socket.on(`close-kline-${this.state.pair}`, currentPrice => {
            if(this.state.closePrice) return;
            const profit = this.calculateClosePercent();
            this.setState({
                closePrice: currentPrice,
                profit
            })
        });
        this.socket.on(`depth-${this.state.pair}`, msg => {
            this.setDepth(msg.bids, msg.asks)
        });
        this.socket.on(`error-on-${this.state.pair}`, err => {
            this.setState({ error: err })
        });
        if(this.state.closePrice) {
            let closePercent = ((this.state.closePrice - this.state.buyPrice) / (this.state.buyPrice / 100)).toFixed(2) + '%';
            if(parseFloat(closePercent) > 0) closePercent = '+' + closePercent;
            this.setState({
                profit: closePercent
            });
        }
        axios.get(`/api/fetch-socket-data/${this.state.pair}/${this.state.interval}`)
    };

    componentDidUpdate(prevProps, prevState) {
        if(this.state.data !== prevState.data) {
            google.charts.load('current', {'packages':['corechart']});
            google.charts.setOnLoadCallback(this.drawChart);

            google.charts.load('current', {packages: ['corechart', 'line']});
            google.charts.setOnLoadCallback(this.drawMacdChart);
            google.charts.setOnLoadCallback(this.drawSeveElevenChart);
        };
    };

    drawAllCharts = () => {
        if(this.state.data.length > 0) {
            google.charts.load('current', {'packages':['corechart']});
            google.charts.setOnLoadCallback(this.drawChart);

            google.charts.load('current', {packages: ['corechart', 'line']});
            google.charts.setOnLoadCallback(this.drawMacdChart);
            google.charts.setOnLoadCallback(this.drawSeveElevenChart);
        };
    };

    drawSeveElevenChart = () => {
        const dataEma = this.state.data.map(item => {
            return {
                time: item['Open time'],
                price: item['Close']
            };
        });

        simpleMA(dataEma, 7);
        simpleMA(dataEma, 25);

        let dataColumns = [['Time', 'Ma-7', 'Ma-25']];
        dataEma.filter(item => item['ma-7'] && item['ma-25']).forEach(item => {
            let elem = [item['time'], item['ma-7'] || 0, item['ma-25'] || 0];
            dataColumns.push(elem);
        });
        const data = google.visualization.arrayToDataTable(dataColumns);

        let options = {
            colors: ['#ffda00', '#0a1dff'],
            width: '100%',
            height: 200
        };

        const formatter = new google.visualization.NumberFormat({
            fractionDigits: 8
        });

        let chart = new google.visualization.LineChart(this.sevenEleven);
        formatter.format(data, 1);
        formatter.format(data, 2);
        chart.draw(data, options);
    };

    drawMacdChart = () => {
        const dataEma = this.state.data.map(item => {
            return {
                time: item['Open time'],
                price: item['Close']
            };
        });

        exponentialMovingAverage(dataEma, 12);
        exponentialMovingAverage(dataEma, 26);
        macdCalculate(dataEma);
        const signalMacd = signalMACD(dataEma);

        let dataColumns = [['Time', 'MACD', 'Signal']];
        signalMacd.forEach(item => {
            let elem = [item['time'], item.macd || 0, item.signal || 0];
            dataColumns.push(elem);
        });
        const data = google.visualization.arrayToDataTable(dataColumns);

        let options = {
            colors: ['#a52714', '#0f9d58'],
            width: '100%',
            height : 200
        };

        const formatter = new google.visualization.NumberFormat({
            fractionDigits: 8
        });

        let chart = new google.visualization.LineChart(this.macdChart);
        formatter.format(data, 1);
        formatter.format(data, 2);
        chart.draw(data, options);
    };

    drawChart = () => {
        // let arr = ['Open time', 'Low price', 'Open price', 'Close price', 'High price']
        const arr = this.state.data.map(item => {
            return [
                item['Open time'].split('T')[1].split(':').slice(0,2).join(':'),
                { v: item['Low'], f: item['Low'].toFixed(8) },
                { v: item['Open'], f: item['Open'].toFixed(8) },
                { v: item['Close'], f: item['Close'].toFixed(8) },
                { v: item['High'], f: item['High'].toFixed(8) },
                `Time: ${item['Open time'].split('T')[1].split(':').slice(0,2).join(':')} : Open ${item['Open']} - Close ${item['Close']} : Low ${item['Low']} - High ${item['High']}`
            ]
        });
        let data = google.visualization.arrayToDataTable(arr, true);
        data.setColumnProperty(5, 'role', 'tooltip')
        let options = {
            title: this.props.pair,
            legend: 'none',
            bar: { groupWidth: '100%' }, // Remove space between bars.
            candlestick: {
                fallingColor: { strokeWidth: 1, fill: '#a52714', stroke: '#a52714' }, // red
                risingColor: { strokeWidth: 1, fill: '#0f9d58', stroke: '#0f9d58' }   // green
            },
            tooltip: {
                isHtml: true
            },
            width: '100%',
            height : 500
        };

        let chart = new google.visualization.CandlestickChart(this.chart);

        // google.visualization.events.addListener(chart, 'select', e => {
        //     const {row, column} = chart.getSelection()[0];
        //     console.log(data.getValue(row, column))
        // })

        chart.draw(data, options);
    };

    setDepth = (buy, sell) => {
        const buySumm = buy.reduce((a, b) => a + +b[1], 0);
        const sellSumm = sell.reduce((a, b) => a + +b[1], 0);
        this.setState({
            buyDepth: +buySumm,
            sellDepth: +sellSumm
        });
    };

    deleteOrder = () => {
        this.props.deleteOrder(this.props._id)
    };

    showOrder = () => {
        this.setState({ loading: true });
        axios.get(`/api/fetch-exist-pair/${this.props.pair}/${this.props.interval}/${this.props._id}`)
            .then(res => {
                this.setState({
                    currentPrice: res.data.data[res.data.data.length - 1]['Close'],
                    data: res.data.data,
                    loading: false
                });
            })
            .catch(err => {
                thi.setState({
                    loading: false,
                    error: err.response ? err.repsonse.data.error : err.message
                });
            })
    };

    buyPair = () => {
        this.setState({ loading: true });
        axios.get(`/api/buy-pair/${this.state.pair}/${this.state.interval}/${this.props._id}/${this.state.currentPrice}`)
            .then(res => {
                this.setState({
                    buyPrice: res.data.buyPrice,
                    buyDate: res.data.createdAt,
                    loading: false
                });
            })
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message,
                    loading: false
                });
            })
    };

    closeOrder = () => {
        this.setState({ loading: true });
        this.props.closeOrder({
            id: this.props._id,
            interval: this.state.interval,
            pair: this.state.pair,
            buyDate: this.state.buyDate
        })
            .then(res => {
                const profit = this.calculateClosePercent();
                this.setState({ loading: false,
                    closePrice: res.data.closePrice,
                    currentPrice: res.data.closePrice,
                    profit
                })
            })
            .catch(err => {
                this.setState({
                    loading: false,
                    error: err.response ? err.response.data.error : err.message
                })
            })
    };

    calculateClosePercent = () => {
        if(!this.state.buyPrice) return '';
        let closePercent = ((this.state.currentPrice - this.state.buyPrice) / (this.state.buyPrice / 100)).toFixed(2) + '%';
        if(parseFloat(closePercent) > 0) closePercent = '+' + closePercent;
        return closePercent;
    };

    render() {
        return (
            <div className="Order">
                    {this.props.loading && <div className="loading">Loading...</div>}
                    <div className="main">
                        <p>Pair: <span>{this.state.pair}</span></p>
                        <p>Buy price: <span>{this.state.buyPrice || 'Not buyed yet'}</span></p>
                        <p>Current price: <span>{this.state.currentPrice || 'No current price'}</span></p>
                        <p>Interval: <span>{this.state.interval || 'No interval'}</span></p>
                        <p>Buy time: <span>{this.state.buyDate || 'Not buyed yet'}</span></p>
                        <button className='btn btn-primary'
                                disabled={this.props.loading || this.state.loading} onClick={this.deleteOrder}>Delete order</button>
                        <button className='btn btn-success'
                                disabled={this.props.loading || this.state.loading}
                                onClick={this.showOrder}
                                //onClick={this.drawAllCharts}
                        >
                            Get order data
                        </button>
                        <button className="btn btn-success"
                                style={{  width: '30%' }}
                                disabled={this.state.loading || !!this.state.buyPrice} 
                                onClick={this.buyPair}>
                            {!this.state.buyPrice ?
                            `Buy - ${this.state.pair} - ${this.state.currentPrice}` :
                            `Was bought on ${this.state.buyPrice}`
                        }
                        </button>
                        <button className="btn btn-danger" 
                                disabled={this.state.loading || !!this.state.closePrice || !this.state.buyPrice}
                                onClick={this.closeOrder}>
                            {!!this.state.closePrice ?
                                `Closed on ${this.state.closePrice}: ${this.state.profit}`:
                                `Close order ${this.calculateClosePercent()}`}
                        </button>

                        <Depth
                            buyDepth={this.state.buyDepth}
                            sellDepth={this.state.sellDepth}
                        />


                        {this.state.error && <div className="error">{this.state.error}</div>}
                    </div>
                <div className="chart" ref={node => this.chart = node}></div>
                <div className="chart" ref={node => this.sevenEleven = node}></div>
                <div className="chart" ref={node => this.macdChart = node}></div>

            </div>
        );
    };
};