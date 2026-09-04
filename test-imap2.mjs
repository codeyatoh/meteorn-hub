import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import PostalMime from 'postal-mime';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedData) {
  let keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    keyBuffer = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(encryptedData.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function test() {
  const { data: conn, error } = await supabase
    .from('user_gmail_connections')
    .select('*')
    .ilike('gmail_address', '%a.halmain.official%')
    .limit(1)
    .single();

  if (error || !conn) {
    console.error('Connection not found', error);
    return;
  }

  console.log('Found connection for', conn.gmail_address);

  const appPassword = decrypt({
    encrypted: conn.app_password_encrypted,
    iv: conn.iv,
    authTag: conn.auth_tag,
  });

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: conn.gmail_address, pass: appPassword },
    logger: false,
    socketTimeout: 15000,
    connectionTimeout: 15000,
  });

  try {
    await client.connect();
    console.log('Connected to IMAP');
    
    await client.mailboxOpen('INBOX');
    console.log('Opened INBOX');

    const addressLower = 'a.halmain.official+test3@gmail.com';
    let baseAddress = addressLower;
    if (addressLower.includes('+')) {
      const [name, domain] = addressLower.split('@');
      baseAddress = `${name.split('+')[0]}@${domain}`;
    }

    const allUids = await client.search({ seq: '1:*' }, { uid: true });
    console.log('All recent UIDs length:', allUids ? allUids.length : 0);
    
    let uids = [];
    if (Array.isArray(allUids)) {
      uids = allUids.slice(-5); // take last 5
    }

    const parser = new PostalMime();

    if (Array.isArray(uids)) {
      for (const uid of uids) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (msg && msg.source) {
          const raw = msg.source.toString();
          
          console.log('\n--- Message UID', uid, '---');
          
          const parsed = await parser.parse(msg.source);
          
          console.log('parsed.deliveredTo:', parsed.deliveredTo);
          console.log('parsed.to:', JSON.stringify(parsed.to));
          console.log('parsed.cc:', JSON.stringify(parsed.cc));
          console.log('parsed.bcc:', JSON.stringify(parsed.bcc));
          console.log('parsed.headers find delivered-to:', parsed.headers.find(h => h.key.toLowerCase() === 'delivered-to')?.value);

          const toHeaders = parsed.to?.map(t => t.address?.toLowerCase() || '') || [];
          const ccHeaders = parsed.cc?.map(t => t.address?.toLowerCase() || '') || [];
          const bccHeaders = parsed.bcc?.map(t => t.address?.toLowerCase() || '') || [];
          
          const deliveredTo = parsed.deliveredTo?.toLowerCase() || parsed.headers?.find(h => h.key.toLowerCase() === 'delivered-to')?.value?.toLowerCase() || '';
          
          const allRecipients = [...toHeaders, ...ccHeaders, ...bccHeaders, deliveredTo].join(' ');
          
          const normalize = (s) => s.toLowerCase().replace(/\./g, '');
          const inHeaders = normalize(allRecipients).includes(normalize(addressLower)) || 
                            normalize(allRecipients).includes(normalize(baseAddress));
          
          console.log('inHeaders evaluate:', inHeaders);
        }
      }
    }
    
    await client.mailboxClose();
    await client.logout();
  } catch (err) {
    console.error('IMAP Error:', err);
  }
}

test();
