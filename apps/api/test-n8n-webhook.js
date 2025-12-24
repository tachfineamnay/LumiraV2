const crypto = require('crypto');
const axios = require('axios');

async function testWebhook() {
    const secret = 'votre_secret_32_caracteres_test_123';
    const url = 'http://localhost:3001/api/webhooks/n8n';

    const payloadData = {
        orderId: 'clxx_test_id',
        orderNumber: 'LU241223001',
        status: 'ready',
        content: {
            archetype: 'Le Sage Cosmique',
            reading: 'Votre lecture spirituelle de test...',
            pdfUrl: 'https://s3.example.com/lectures/clxx/lecture.pdf',
            audioUrl: 'https://s3.example.com/lectures/clxx/audio.mp3',
            mandalaSvg: '<svg>test</svg>'
        }
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyString = JSON.stringify(payloadData);
    const payloadToSign = `${timestamp}.${nonce}.${bodyString}`;

    const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');

    console.log('--- Test Data ---');
    console.log('Timestamp:', timestamp);
    console.log('Nonce:', nonce);
    console.log('Signature:', signature);
    console.log('-----------------');

    try {
        const response = await axios.post(url, payloadData, {
            headers: {
                'x-webhook-signature': `sha256=${signature}`,
                'x-webhook-timestamp': timestamp,
                'x-webhook-nonce': nonce,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

testWebhook();
