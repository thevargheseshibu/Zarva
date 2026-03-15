module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            ['module-resolver', {
                root: ['./src'],
                alias: {
                    '@app': './src/app',
                    '@features': './src/features',
                    '@shared': './src/shared',
                    '@infra': './src/infra',
                    '@auth': './src/features/auth',
                    '@jobs': './src/features/jobs',
                    '@inspection': './src/features/inspection',
                    '@payment': './src/features/payment',
                    '@notifications': './src/features/notifications',
                    '@worker': './src/features/worker',
                    '@customer': './src/features/customer'
                }
            }],
            'react-native-reanimated/plugin',
        ],
    };
};
