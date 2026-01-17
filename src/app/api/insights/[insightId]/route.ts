import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/monitoring/utils/logger';

const logger = createLogger('insights-api');

// GET: Fetch a single insight
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const { insightId } = await params;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: insight, error } = await supabase
      .from('insights')
      .select('*')
      .eq('id', insightId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Insight not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, insight });
  } catch (error) {
    logger.error('Error fetching insight', {
      error: (error as Error).message,
      insightId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH: Update insight status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const { insightId } = await params;

  try {
    const body = await request.json();
    const { status, userId } = body;

    if (!status || !['new', 'picked_up', 'ignored', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'picked_up') {
      updates.picked_up_at = new Date().toISOString();
      if (userId) updates.picked_up_by = userId;
    } else if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
      if (userId) updates.resolved_by = userId;
    }

    const { data: insight, error } = await supabase
      .from('insights')
      .update(updates)
      .eq('id', insightId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Insight not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    logger.info('Insight status updated', { insightId, status });

    return NextResponse.json({ success: true, insight });
  } catch (error) {
    logger.error('Error updating insight', {
      error: (error as Error).message,
      insightId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
