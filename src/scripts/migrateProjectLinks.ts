import mongoose from 'mongoose';
import 'dotenv/config';
import Project from '../models/Project';

async function migrateProjectLinks(): Promise<void> {
    try {
        console.log('Starting project link migration...');

        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI environment variable is required');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        const result = await Project.updateMany(
            { link: { $exists: false } },
            { $set: { link: null } }
        );

        console.log(`Matched projects: ${result.matchedCount}`);
        console.log(`Updated projects: ${result.modifiedCount}`);
        console.log('Project link migration completed');
    } catch (error: any) {
        console.error('Project link migration failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
        process.exit(0);
    }
}

migrateProjectLinks();
