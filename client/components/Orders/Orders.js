import { connect } from 'react-redux';
import axios from 'axios';

import { getCandleData, getActiveOrders, deleteOrder } from '../../actions/pairsAPI';

import './Orders.sass';
import Order from "../Order/Order";

const mapState = state => {
    return {
        orders: state.trades
    }
};

@connect(mapState, { getCandleData, getActiveOrders, deleteOrder })
export default class Orders extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            orders: this.props.orders || [],
            loading: false,
            error: ''
        };
    };

    componentDidMount() {
        this.setState({ loading: true });
        this.props.getActiveOrders()
            .then(res => {
                this.setState({
                    orders: res.data.orders,
                    loading: false
                });
            })
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message,
                    loading: false
                })
            })
    };

    componentDidUpdate(prevProps, prevState) {
        if(this.state.orders !== prevState.orders) {
            console.log('sort')
            this.setState({
                orders: this.state.orders.sort((a, b) => {
                    if(a.pair > b.pair) {
                        return 1;
                    } else if(a.pair < b.pair) {
                        return -1;
                    } else {
                        return 0;
                    }
                })
            });
        };
    };

    deleteOrder = (_id) => {
        this.setState({ loading: true });
        this.props.deleteOrder(_id)
            .then(res => {
                this.setState({
                    orders: this.state.orders.filter(item => item._id !== _id),
                    loading: false
                })
            })
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message,
                    loading: false
                })
            })
    };

    deleteUnusedOrders = () => {
        axios.post('/api/delete-unused', { orders: this.state.orders.filter(item => !item.buyPrice) })
            .then(res => {
                this.setState({
                    orders: res.data.orders.filter(item => item => !!item.buyPrice)
                });
            })
            .catch(err => {
                this.setState({ error: err.response ? err.response.data.error : err.message })
            })
    };

    render() {
        return (
            <div className="Orders">
                {this.state.error && <div className="error">{this.state.error}</div>}
                <button className="btn btn-danger" onClick={this.deleteUnusedOrders}>Delete unused orders</button>
                {!this.state.loading ? (this.state.orders.length > 0 ? this.state.orders.map((item, i) =>
                    <Order
                        {...item}
                        key={item._id}
                        loading={this.state.loading}
                        deleteOrder={this.deleteOrder}
                    />
                ) :
                    <div>No orders</div>) :
                    <div className="loading">Loading...</div>
                }
            </div>
        );
    };
};