import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TimeLog from '@/models/TimeLog';

// Helper to extract ID from params in Next.js 15+ (Accessing params as promise if needed, but in route handlers it's 2nd arg)
// Actually in Next.js 15 params are async. I should check the version. package.json said "next": "16.1.6".
// In Next 15/16, params is a Promise.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await req.json();

        // Admin or self update? Usually admin for past logs.
        // For now, allow update of description, duration, times.

        const updatedLog = await TimeLog.findByIdAndUpdate(id, body, {
            new: true,
            runValidators: true,
        });

        if (!updatedLog) {
            return NextResponse.json({ error: 'Log not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, log: updatedLog }, { status: 200 });
    } catch (error: any) {
        console.error('Update log error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;

        const deletedLog = await TimeLog.findByIdAndDelete(id);

        if (!deletedLog) {
            return NextResponse.json({ error: 'Log not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Log deleted' }, { status: 200 });
    } catch (error: any) {
        console.error('Delete log error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
