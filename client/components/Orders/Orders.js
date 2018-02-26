import { connect } from 'react-redux';
import axios from 'axios';

import { getCandleData, getActiveOrders, deleteOrder } from '../../actions/pairsAPI';

import './Orders.sass';
import Order from "../Order/Order";


const arrow = {
    width: 20,
    height: 20,
    boxSizing: 'border-box',
    transform: 'rotate(45deg)'
};
const leftArrow = {
    ...arrow,
    borderLeft: '1px solid black',
    borderBottom: '1px solid black',
    borderRight: '1px solid transparent',
    borderTop: '1px solid transparent'
};


const mapState = state => {
    return {
        orders: state.trades
    }
};

@connect(mapState, { getCandleData, getActiveOrders, deleteOrder })
export default class Orders extends React.Component {
    constructor(props) {
        super(props);

        this.showOrders = 3;

        this.state = {
            orders: this.props.orders || [],
            loading: false,
            page: 0,
            totalPages: 1,
            error: ''
        };
    };

    componentDidMount() {
        this.setState({ loading: true });
        this.props.getActiveOrders()
            .then(() => {
                this.setState({ loading: false });
            })
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message,
                    loading: false
                })
            })
    };

    componentDidUpdate(prevProps, prevState) {
        if(this.props.orders !== prevProps.orders) {
            this.setTotalPages();
            this.setPagination();

        };
        if(this.state.page !== prevState.page) {
            this.setPagination();
        };
    };

    setPagination = () => {
        this.setState({
            orders: this.props.orders.slice(this.state.page * this.showOrders, this.state.page * this.showOrders + this.showOrders)
                .sort((a, b) => {
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

    setTotalPages = () => {
        this.setState({
            totalPages: Math.ceil(this.props.orders.length / this.showOrders)
        });
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

    pagination = e => {
        const route = e.currentTarget.getAttribute('data-route') === 'left';
        let page = route ? (this.state.page - 1) : (this.state.page + 1);

        if(page < 0) page = 0;
        if(page > this.state.totalPages - 1) page = this.state.totalPages - 1;
        this.setState({
            page
        });
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
                <div className="pages-wrapper">
                    <button className="btn btn-primary" onClick={this.pagination} data-route='left'>
                        <span className="arrow leftArrow"></span>
                        <span className="arrow leftArrow"></span>
                    </button>
                    <strong className="pages">{`${this.state.page + 1} / ${this.state.totalPages}`}</strong>
                    <button className="btn btn-primary" onClick={this.pagination} data-route='right'>
                        <span className="arrow rightArrow"></span>
                        <span className="arrow rightArrow"></span>
                    </button>
                </div>
            </div>
        );
    };
};