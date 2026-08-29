import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    
    // We fetch users from auth.users and their temp_mail_access
    // However, since we can't easily join auth.users in a normal query via API,
    // we'll fetch all temp_mail_access rows and then resolve emails/nicknames.
    const { data: accessRows, error } = await adminClient
      .from('temp_mail_access')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!accessRows || accessRows.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Get user details
    const userIds = accessRows.map((r) => r.user_id);
    const { data: profilesData } = await adminClient.rpc('get_chat_profiles', { user_ids: userIds });

    // Compute today in PHT
    const todayPht = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // Fetch faucet stats to get total_donated for each user (for dynamic tier limits)
    const { data: faucetStats } = await adminClient
      .from('faucet_user_stats')
      .select('user_id, total_donated')
      .in('user_id', userIds);

    const faucetMap: Record<string, number> = {};
    if (faucetStats) {
      faucetStats.forEach((f: { user_id: string; total_donated: number }) => {
        faucetMap[f.user_id] = f.total_donated || 0;
      });
    }

    const requests = accessRows.map((row) => {
      const profile = profilesData?.find((p: { user_id: string; full_name: string }) => p.user_id === row.user_id);
      // If last_reset_date is older than today PHT, the count is 0 for today
      const effectiveDailyCount = (row.last_reset_date < todayPht) ? 0 : row.daily_count;
      return {
        ...row,
        daily_count: effectiveDailyCount,
        user_name: profile?.full_name || 'Unknown User',
        total_donated: faucetMap[row.user_id] ?? 0,
      };
    });

    return NextResponse.json({ requests });
  } catch (err) {
    console.error('admin temp_mail_requests GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, status } = body as { user_id: string; status: 'approved' | 'rejected' };

    if (!user_id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('temp_mail_access')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (error) {
      console.error('Error updating request status:', error);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('admin temp_mail_requests POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
