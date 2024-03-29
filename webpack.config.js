// @ts-nocheck
const path = require('path');

const base = {
    entry: {
        "main": './src/main/entry.tsx',
        "test": './src/test/entry.tsx',
        "ai.worker.rand": './src/worker_ai/rand.ts',
        "ai.worker.x": './src/worker_ai/x.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'static'),
        // needed as default hash fn has now been deemed insecure
        hashFunction: 'xxhash64',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ],
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        roots: ["src"],
    },
    optimization: {
        // minimize: false
    },
}

module.exports = (env, argv) => {
    console.log("using args: ", argv)
    return base;
};