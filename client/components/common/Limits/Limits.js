import axios from 'axios';

import Input from '../../common/Input/Input';

export default class limits extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            takeProfit: {
                value: this.props.takeProfit || '',
                fixedValue: this.props.takeProfit || '',
                hidden: true
            },
            buyLimit: {
                value: this.props.buyLimit || '',
                fixedValue: this.props.buyLimit || '',
                hidden: true
            },
            loading: false,
            error: ''
        }
    };

    componentDidUpdate(prevProps, prevState) {
        if(this.state.loading !== this.props.loading) {
            this.setState({
                loading: this.props.loading
            });
        };
    };

    onChangeInput = e => {
        if((e.target.value).match(/[a-z]/gi)) return;
        this.setState({
            [e.target.name]: {
                ...this.state[e.target.name],
                value: e.target.value
            }
        });
    };

    onClickInput = name => {
        this.setState({
            [name]: {
                ...this.state[name],
                hidden: false
            },
            error: ''
        });
    };

    confirmChangingInput = name => {
        this.setState({ loading: true });
        axios.post(`/api/limits`, { order: name, price: this.state[name].value, id: this.props.id })
            .then(order => {
                this.setState({
                    [name]: {
                        ...this.state[name],
                        hidden: true,
                        fixedValue: this.state[name].value
                    },
                    loading: false
                });
                this.props.limitFunc({ order: name, price: this.state[name].value })
            })
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message,
                    loading: false
                })
            })
    };

    cancelInputingInput = name => {
        this.setState({
            [name]: {
                ...this.state[name],
                hidden: true,
                value: this.state[name].fixedValue
            }
        });
    };

    render() {
        return (
            <div className="Limits" style={{ padding: ' 20px 0' }}>
                {this.state.error && <div className="error">{this.state.error}</div>}
                <Input
                    name='takeProfit'
                    value={this.state.takeProfit.value}
                    label={`Profit to ${this.props.pair}`}
                    hidden={this.state.takeProfit.hidden}
                    disabled={this.state.loading}
                    onChange={this.onChangeInput}
                    onClick={this.onClickInput}
                    confirmChanging={this.confirmChangingInput}
                    fixedValue={this.state.takeProfit.fixedValue}
                    cancelInputing={this.cancelInputingInput}
                />
                <Input
                    name='buyLimit'
                    value={this.state.buyLimit.value}
                    label={`buyLimit to ${this.props.pair}`}
                    hidden={this.state.buyLimit.hidden}
                    disabled={this.state.loading}
                    onChange={this.onChangeInput}
                    onClick={this.onClickInput}
                    confirmChanging={this.confirmChangingInput}
                    fixedValue={this.state.buyLimit.fixedValue}
                    cancelInputing={this.cancelInputingInput}
                />
            </div>
        );
    };
};