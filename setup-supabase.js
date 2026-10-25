const SUPABASE_URL = 'https://nywtmiauzroatyitaxbx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55d3RtaWF1enJvYXR5aXRheGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTc5NzYsImV4cCI6MjEwODQ5Mzk3Nn0.e3c-oM9BtftyKZ63JXgSr31moNcgnPEhLWCTU7xAXCs';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55d3RtaWF1enJvYXR5aXRheGJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjkxNzk3NiwiZXhwIjoyMTA4NDkzOTc2fQ.DUErZVdCFAN_smlShwXyNhVGvbA1YkynQztOJADw8lY';

async function setup() {
  console.log('1. Checking existing buckets...');
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  const buckets = await listRes.json();
  console.log('Existing buckets:', buckets);

  const exists = Array.isArray(buckets) && buckets.some(b => b.id === 'amader-golpo');
  if (!exists) {
    console.log('2. Creating public storage bucket "amader-golpo"...');
    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'amader-golpo',
        name: 'amader-golpo',
        public: true
      })
    });
    console.log('Create bucket response:', createRes.status, await createRes.text());
  } else {
    console.log('Bucket "amader-golpo" already exists.');
  }

  console.log('3. Initializing index.json in bucket if not present...');
  const checkIndex = await fetch(`${SUPABASE_URL}/storage/v1/object/public/amader-golpo/index.json`);
  if (checkIndex.status !== 200) {
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/amader-golpo/index.json`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: JSON.stringify({ proposals: [] })
    });
    console.log('Upload index.json response:', uploadRes.status, await uploadRes.text());
  } else {
    console.log('index.json already exists:', await checkIndex.json());
  }
}

setup().catch(console.error);
