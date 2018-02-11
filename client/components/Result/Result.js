import { connect } from 'react-redux';

import { getResult } from '../../actions/pairsAPI';

import './Result.sass';

const mapState = state => {
    return {
        result: state.result
    }
};

@connect(mapState, { getResult })
export default class Result extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            error: ''
        };
    };
    
    componentDidMount() {
        this.props.getResult()
            .catch(err => {
                this.setState({
                    error: err.response ? err.response.data.error : err.message
                });
            })
    };
    
    render() {

        const error = <div className="error">{this.state.error}</div>

        return(
            <div className="result">{this.state.error ? error : `Result: ${this.props.result}`}</div>
        );
    }
};