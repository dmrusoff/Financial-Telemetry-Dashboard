import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
        },
    },
});

const client = new PlaidApi(configuration);

export default async function handler(req, res) {
    // Add CORS headers for production
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Pick products based on the table being linked
        const { table } = req.body || {};
        let products;
        if (table === 'investments') {
            products = ['investments'];
        } else if (table === 'credit_cards') {
            products = ['transactions'];
        } else {
            // banking - default
            products = ['auth', 'transactions'];
        }

        const response = await client.linkTokenCreate({
            user: { client_user_id: 'user-id' },
            client_name: 'Finance Dashboard',
            products,
            country_codes: ['US'],
            language: 'en',
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Plaid Link Token Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
}
