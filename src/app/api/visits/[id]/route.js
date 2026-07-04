import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Visit from '@/models/Visit';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const visit = await Visit.findById(id).lean();
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
      
    return NextResponse.json(visit);
  } catch (error) {
    console.error('Visit GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const data = await request.json();
    
    // Check current status before allowing edit
    const existingVisit = await Visit.findById(id);
    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    
    if (existingVisit.status !== 'Draft' && existingVisit.status !== 'Rejected' && existingVisit.status !== 'Cancelled') {
       return NextResponse.json({ error: 'Cannot edit a visit that is pending approval or already approved.' }, { status: 400 });
    }
    
    const visit = await Visit.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    
    return NextResponse.json(visit);
  } catch (error) {
    console.error('Visit PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const visit = await Visit.findByIdAndDelete(id);
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visit DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
