const path = require('path');

const base = {
    entry: './src/entry.tsx',
    output: {
        filename: 'app.bundle.js',
        path: path.resolve(__dirname, 'static'),
        // needed as default hash fn has now been deemed insecure
        hashFunction: 'xxhash64',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx'],
        roots: ["src"],
    }
}

module.exports = (env, argv) => {
    console.log("using args: ", argv)
    return base;
};