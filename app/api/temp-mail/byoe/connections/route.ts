import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';
import { encrypt } from '@/lib/utils/encryption';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_gmail_connections')
      .select('id, gmail_address, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ connections: data });
  } catch (err) {
    console.error('Fetch BYOE connections error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, appPassword } = body;

    if (!email || !appPassword) {
      return NextResponse.json({ error: 'Email and App Password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim();
    // Google app passwords often contain spaces when copied from the UI
    const cleanAppPassword = appPassword.replace(/\s+/g, '');

    // 1. Test IMAP Connection
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: cleanEmail,
        pass: cleanAppPassword,
      },
      logger: false, // Disable verbose logging
    });

    try {
      await client.connect();
      await client.logout();
    } catch (imapError: unknown) {
      console.error('IMAP Test Error:', imapError);
      return NextResponse.json(
        { error: 'Failed to connect. Please check your App Password and ensure IMAP is enabled in your Gmail settings.' },
        { status: 400 }
      );
    }

    // 2. Encrypt the app password
    const { encrypted, iv, authTag } = encrypt(cleanAppPassword);

    // 3. Save to Supabase
    const { data, error } = await supabase
      .from('user_gmail_connections')
      .upsert(
        {
          user_id: user.id,
          gmail_address: cleanEmail,
          app_password_encrypted: encrypted,
          iv,
          auth_tag: authTag,
        },
        { onConflict: 'user_id,gmail_address' }
      )
      .select('id, gmail_address, created_at')
      .single();

    if (error) {
      console.error('Supabase BYOE insert error:', error);
      // Handle unique constraint error gracefully if needed
      return NextResponse.json({ error: 'Failed to save connection.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, connection: data });
  } catch (err) {
    console.error('Create BYOE connection error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_gmail_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete BYOE connection error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
