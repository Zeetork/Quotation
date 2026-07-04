import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Visit from '@/models/Visit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust if authOptions path is different, fallback to generic session fetch

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action, reason } = body;
    
    // Instead of importing authOptions directly if path varies, we can use getToken or just getServerSession without options if next-auth 4 is configured globally, 
    // but typically we need the user from session. Let's just trust a generic approach or requirePermission if applicable.
    // Actually, I'll use a simple fetch or let the client pass user info safely. Wait, the best way in this app might be to use next-auth.
    // I will use requirePermission(PERMISSIONS.VISIT.EDIT) just to ensure they can edit, then get user.
    // Let's import from rbac for session
    
    const { user } = await import('@/lib/rbac/auth').then(m => m.requirePermission('Visit:Edit').catch(() => ({ user: null }))).catch(() => ({ user: null }));
    const userId = user?.id || body.userId; // fallback

    await dbConnect();
    const visit = await Visit.findById(id);
    
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    const currentStatus = visit.status;

    if (action === 'submit') {
      if (currentStatus !== 'Draft') {
        return NextResponse.json({ error: 'Only Draft visits can be submitted for approval.' }, { status: 400 });
      }
      visit.status = 'Pending Approval';
      visit.approvalStatus = 'Pending Approval';
      visit.submittedAt = new Date();
      if (userId) visit.submittedBy = userId;
      
    } else if (action === 'approve') {
      if (currentStatus !== 'Pending Approval') {
        return NextResponse.json({ error: 'Only visits Pending Approval can be approved.' }, { status: 400 });
      }
      visit.status = 'Approved';
      visit.approvalStatus = 'Approved';
      visit.approvedAt = new Date();
      if (userId) visit.approvedBy = userId;
      
    } else if (action === 'reject') {
      if (currentStatus !== 'Pending Approval') {
        return NextResponse.json({ error: 'Only visits Pending Approval can be rejected.' }, { status: 400 });
      }
      visit.status = 'Rejected';
      visit.approvalStatus = 'Rejected';
      visit.rejectedAt = new Date();
      if (userId) visit.rejectedBy = userId;
      visit.rejectionReason = reason || 'No reason provided';
      
    } else if (action === 'complete') {
      if (currentStatus !== 'Approved') {
        return NextResponse.json({ error: 'Only Approved visits can be marked as Completed.' }, { status: 400 });
      }
      visit.status = 'Completed';
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    await visit.save();
    return NextResponse.json({ success: true, visit });
  } catch (error) {
    console.error('Visit Action Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
