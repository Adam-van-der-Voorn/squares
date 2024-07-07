// @ts-nocheck
const path = require('path');

const base = {
    entry: {
        "main": './src/main/entry.tsx',
        "test": './src/test/entry.tsx',
        "ai.worker.rand": './src/worker_ai/rand.ts',
        "ai.worker.search": './src/worker_ai/search/entry.ts',
        "ai.worker.quick": './src/worker_ai/quick/entry.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'static', 'js'),
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