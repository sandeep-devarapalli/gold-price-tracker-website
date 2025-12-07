const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAIKey() {
  console.log('🔍 Testing OpenAI API key...\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set in .env file');
    console.log('\nPlease add to your .env file:');
    console.log('OPENAI_API_KEY=sk-...');
    process.exit(1);
  }
  
  // Check if key starts with sk-
  if (!apiKey.startsWith('sk-')) {
    console.warn('⚠️  Warning: OpenAI API key should typically start with "sk-"');
  }
  
  console.log(`✅ API Key found: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`   Key length: ${apiKey.length} characters\n`);
  
  console.log('📤 Making test API call to OpenAI...');
  
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Make a simple test call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Say "API key is working" if you receive this message.'
        }
      ],
      max_tokens: 20,
      temperature: 0.5,
    });
    
    const message = response.choices[0]?.message?.content;
    
    if (message) {
      console.log('✅ OpenAI API key is VALID!');
      console.log(`   Response: ${message}\n`);
      console.log('✅ API Key Status: WORKING');
      console.log('   You can now use OpenAI features for article analysis and predictions.\n');
      process.exit(0);
    } else {
      console.error('❌ OpenAI API returned empty response');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ OpenAI API key test FAILED!\n');
    
    if (error.status === 401) {
      console.error('   Error: Invalid API key (401 Unauthorized)');
      console.log('\n   Please check:');
      console.log('   1. Your OpenAI API key is correct');
      console.log('   2. The key has not expired');
      console.log('   3. You have sufficient credits in your OpenAI account');
    } else if (error.status === 429) {
      console.error('   Error: Rate limit exceeded (429)');
      console.log('\n   Your API key is valid, but you have hit the rate limit.');
      console.log('   Please try again later.');
    } else if (error.message && error.message.includes('API key')) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Error: ${error.message || 'Unknown error'}`);
      if (error.status) {
        console.error(`   Status Code: ${error.status}`);
      }
    }
    
    console.log('\n❌ API Key Status: INVALID OR ERROR');
    process.exit(1);
  }
}

testOpenAIKey();

