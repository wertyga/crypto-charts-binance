import webpack from 'webpack';
import path from 'path';


module.exports = {

    entry: {
        bundle: path.join(__dirname, 'client/index.js')
    },

    output: {
        path: '/',
        publicPath: '/',
        filename: '[name].js'
    },

    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loaders: ['react-hot-loader/webpack', 'babel-loader']

            },
            {
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            },
            {
                test: /\.sass$/,
                loaders: ['style-loader', 'css-loader', 'sass-loader']
            },
            {
                test: /\.eot$|.ttf$|.woff$|.jpg$|.png$|.svg$|.woff2$/,
                loaders: ['file-loader']
            }
        ]
    },

    plugins: [
        // new webpack.optimize.CommonsChunkPlugin({
        //     name: 'common',
        //     filename: '[name].common.js'
        // }),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.ProvidePlugin({
            'React': 'react',
            "PropTypes":"prop-types",
        })
    ],

    resolve: {
        extensions: ['.js', '.jsx']
    }
}