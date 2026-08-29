import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: access, error } = await supabase
      .from('temp_mail_access')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching temp_mail_access:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!access) {
      return NextResponse.json({ status: 'none', daily_count: 0, last_reset_date: null });
    }

    // Check if it's a new day in PHT (Asia/Manila)
    const phtDateStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Manila', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());

    let { daily_count } = access;
    const { last_reset_date } = access;

    if (last_reset_date < phtDateStr) {
      daily_count = 0;
    }

    // Also fetch total_donated from faucet so the UI can compute the correct tier limit
    const { data: faucetStats } = await supabase
      .from('faucet_user_stats')
      .select('total_donated')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      status: access.status,
      daily_count,
      last_reset_date,
      total_donated: faucetStats?.total_donated ?? 0,
    });
  } catch (err) {
    console.error('temp_mail_access GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phtDateStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Manila', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());

    const { error } = await supabase
      .from('temp_mail_access')
      .insert({
        user_id: user.id,
        status: 'pending',
        daily_count: 0,
        last_reset_date: phtDateStr,
      });

    if (error) {
      console.error('Error inserting temp_mail_access:', error);
      // Might fail if already exists, but the UI shouldn't allow it
      return NextResponse.json({ error: 'Failed to request access' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('temp_mail_access POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
