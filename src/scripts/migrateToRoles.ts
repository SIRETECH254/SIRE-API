import mongoose from 'mongoose';
import 'dotenv/config';
import Role from '../models/Role';
import User from '../models/User';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Project from '../models/Project';
import Quotation from '../models/Quotation';
import Testimonial from '../models/Testimonial';
import Notification from '../models/Notification';

// Default roles configuration
const DEFAULT_ROLES = [
    {
        name: 'client',
        displayName: 'Client',
        description: 'Default role for clients/customers',
        permissions: ['view_own_data', 'view_own_invoices', 'view_own_projects', 'make_payments'],
        isSystemRole: true
    },
    {
        name: 'super_admin',
        displayName: 'Super Admin',
        description: 'Full system access with all permissions',
        permissions: ['*'], // All permissions
        isSystemRole: true
    },
    {
        name: 'finance',
        displayName: 'Finance Manager',
        description: 'Access to financial operations, invoices, and payments',
        permissions: ['view_invoices', 'create_invoices', 'view_payments', 'manage_payments', 'view_reports'],
        isSystemRole: true
    },
    {
        name: 'project_manager',
        displayName: 'Project Manager',
        description: 'Access to project management and team assignment',
        permissions: ['view_projects', 'create_projects', 'update_projects', 'assign_team', 'view_milestones'],
        isSystemRole: true
    },
    {
        name: 'staff',
        displayName: 'Staff',
        description: 'Basic admin access for staff members',
        permissions: ['view_clients', 'view_services', 'view_projects'],
        isSystemRole: true
    }
];

interface MigrationStats {
    rolesCreated: number;
    usersMigrated: number;
    clientsMigrated: number;
    invoicesUpdated: number;
    paymentsUpdated: number;
    projectsUpdated: number;
    quotationsUpdated: number;
    testimonialsUpdated: number;
    notificationsUpdated: number;
    errors: string[];
}

async function migrateToRoles(): Promise<void> {
    const stats: MigrationStats = {
        rolesCreated: 0,
        usersMigrated: 0,
        clientsMigrated: 0,
        invoicesUpdated: 0,
        paymentsUpdated: 0,
        projectsUpdated: 0,
        quotationsUpdated: 0,
        testimonialsUpdated: 0,
        notificationsUpdated: 0,
        errors: []
    };

    try {
        console.log('🚀 Starting migration to role-based system...\n');

        // Connect to database
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI environment variable is required');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Step 1: Create default roles
        console.log('📋 Step 1: Creating default roles...');
        const roleMap: Map<string, string> = new Map();

        for (const roleData of DEFAULT_ROLES) {
            try {
                let role = await Role.findOne({ name: roleData.name });

                if (!role) {
                    role = new Role(roleData);
                    await role.save();
                    console.log(`   ✓ Created role: ${roleData.displayName}`);
                    stats.rolesCreated++;
                } else {
                    console.log(`   ⊙ Role already exists: ${roleData.displayName}`);
                }

                roleMap.set(roleData.name, role._id.toString());
            } catch (error: any) {
                const errorMsg = `Failed to create role ${roleData.name}: ${error.message}`;
                console.error(`   ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }
        console.log('');

        // Step 2: Migrate existing Users (map role enum to Role references)
        console.log('👥 Step 2: Migrating existing Users...');
        const users = await User.find({});
        const roleEnumMap: Record<string, string> = {
            'super_admin': 'super_admin',
            'finance': 'finance',
            'project_manager': 'project_manager',
            'staff': 'staff',
            'admin': 'super_admin' // Map old 'admin' to 'super_admin'
        };

        for (const user of users) {
            try {
                // Check if user already has roles (already migrated)
                if (user.roles && user.roles.length > 0) {
                    console.log(`   ⊙ User ${user.email} already has roles assigned`);
                    continue;
                }

                // Get role from old enum field
                const oldRole = (user as any).role;
                if (oldRole) {
                    const roleName = roleEnumMap[oldRole] || 'staff';
                    const roleId = roleMap.get(roleName);

                    if (roleId) {
                        user.roles = [new mongoose.Types.ObjectId(roleId)];
                        await user.save();
                        console.log(`   ✓ Migrated user ${user.email}: ${oldRole} → ${roleName}`);
                        stats.usersMigrated++;
                    } else {
                        const errorMsg = `Role ${roleName} not found for user ${user.email}`;
                        console.error(`   ✗ ${errorMsg}`);
                        stats.errors.push(errorMsg);
                    }
                } else {
                    // No role assigned, assign default 'staff' role
                    const staffRoleId = roleMap.get('staff');
                    if (staffRoleId) {
                        user.roles = [new mongoose.Types.ObjectId(staffRoleId)];
                        await user.save();
                        console.log(`   ✓ Assigned default 'staff' role to user ${user.email}`);
                        stats.usersMigrated++;
                    }
                }
            } catch (error: any) {
                const errorMsg = `Failed to migrate user ${user.email}: ${error.message}`;
                console.error(`   ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }
        console.log('');

        // Step 3: Migrate Clients to Users
        console.log('👤 Step 3: Migrating Clients to Users...');
        // Access Client collection directly since model is deleted
        if (!mongoose.connection.db) {
            throw new Error('Database connection not established');
        }
        const ClientCollection = mongoose.connection.db.collection('clients');
        const clients = await ClientCollection.find({}).toArray();
        const clientRoleIdStr = roleMap.get('client');
        if (!clientRoleIdStr) {
            throw new Error('Client role not found. Cannot proceed with client migration.');
        }
        const clientRoleId = new mongoose.Types.ObjectId(clientRoleIdStr);


        const clientIdMap: Map<string, string> = new Map(); // old Client._id → new User._id

        for (const client of clients) {
            try {
                const clientId = client._id.toString();
                const clientEmail = client.email;

                // Check if user with same email already exists
                const existingUser = await User.findOne({ email: clientEmail });

                if (existingUser) {
                    // User already exists, just map the ID
                    clientIdMap.set(clientId, existingUser._id.toString());
                    console.log(`   ⊙ Client ${clientEmail} already exists as User, mapping ID`);
                    continue;
                }

                // Create new User from Client data
                const newUser = new User({
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: clientEmail,
                    password: client.password,
                    phone: client.phone,
                    company: client.company,
                    address: client.address,
                    city: client.city,
                    country: client.country,
                    avatar: client.avatar,
                    avatarPublicId: client.avatarPublicId,
                    roles: [new mongoose.Types.ObjectId(clientRoleId.toString())],
                    isActive: client.isActive ?? true,
                    emailVerified: client.emailVerified ?? false,
                    otpCode: client.otpCode,
                    otpExpiry: client.otpExpiry,
                    resetPasswordToken: client.resetPasswordToken,
                    resetPasswordExpiry: client.resetPasswordExpiry,
                    lastLoginAt: client.lastLoginAt,
                    notificationPreferences: client.notificationPreferences,
                    createdAt: client.createdAt,
                    updatedAt: client.updatedAt
                });

                await newUser.save();
                clientIdMap.set(clientId, newUser._id.toString());
                console.log(`   ✓ Migrated client ${clientEmail} to User`);
                stats.clientsMigrated++;
            } catch (error: any) {
                const errorMsg = `Failed to migrate client ${client.email || 'unknown'}: ${error.message}`;
                console.error(`   ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }
        console.log('');

        // Step 4: Update all references from Client to User
        console.log('🔗 Step 4: Updating references from Client to User...');

        // Update Invoices
        console.log('   Updating Invoices...');
        for (const [oldClientId, newUserId] of clientIdMap.entries()) {
            try {
                const result = await Invoice.updateMany(
                    { client: oldClientId },
                    { $set: { client: newUserId } }
                );
                if (result.modifiedCount > 0) {
                    stats.invoicesUpdated += result.modifiedCount;
                    console.log(`     ✓ Updated ${result.modifiedCount} invoice(s) for client ${oldClientId}`);
                }
            } catch (error: any) {
                const errorMsg = `Failed to update invoices for client ${oldClientId}: ${error.message}`;
                console.error(`     ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }

        // Update Payments
        console.log('   Updating Payments...');
        for (const [oldClientId, newUserId] of clientIdMap.entries()) {
            try {
                const result = await Payment.updateMany(
                    { client: oldClientId },
                    { $set: { client: newUserId } }
                );
                if (result.modifiedCount > 0) {
                    stats.paymentsUpdated += result.modifiedCount;
                    console.log(`     ✓ Updated ${result.modifiedCount} payment(s) for client ${oldClientId}`);
                }
            } catch (error: any) {
                const errorMsg = `Failed to update payments for client ${oldClientId}: ${error.message}`;
                console.error(`     ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }

        // Update Projects
        console.log('   Updating Projects...');
        for (const [oldClientId, newUserId] of clientIdMap.entries()) {
            try {
                const result = await Project.updateMany(
                    { client: oldClientId },
                    { $set: { client: newUserId } }
                );
                if (result.modifiedCount > 0) {
                    stats.projectsUpdated += result.modifiedCount;
                    console.log(`     ✓ Updated ${result.modifiedCount} project(s) for client ${oldClientId}`);
                }
            } catch (error: any) {
                const errorMsg = `Failed to update projects for client ${oldClientId}: ${error.message}`;
                console.error(`     ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }

        // Update Quotations
        console.log('   Updating Quotations...');
        for (const [oldClientId, newUserId] of clientIdMap.entries()) {
            try {
                const result = await Quotation.updateMany(
                    { client: oldClientId },
                    { $set: { client: newUserId } }
                );
                if (result.modifiedCount > 0) {
                    stats.quotationsUpdated += result.modifiedCount;
                    console.log(`     ✓ Updated ${result.modifiedCount} quotation(s) for client ${oldClientId}`);
                }
            } catch (error: any) {
                const errorMsg = `Failed to update quotations for client ${oldClientId}: ${error.message}`;
                console.error(`     ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }

        // Update Testimonials
        console.log('   Updating Testimonials...');
        for (const [oldClientId, newUserId] of clientIdMap.entries()) {
            try {
                const result = await Testimonial.updateMany(
                    { client: oldClientId },
                    { $set: { client: newUserId } }
                );
                if (result.modifiedCount > 0) {
                    stats.testimonialsUpdated += result.modifiedCount;
                    console.log(`     ✓ Updated ${result.modifiedCount} testimonial(s) for client ${oldClientId}`);
                }
            } catch (error: any) {
                const errorMsg = `Failed to update testimonials for client ${oldClientId}: ${error.message}`;
                console.error(`     ✗ ${errorMsg}`);
                stats.errors.push(errorMsg);
            }
        }
        console.log('');

        // Step 5: Update Notifications
        console.log('🔔 Step 5: Updating Notifications...');
        try {
            // Update recipientModel from 'Client' to 'User' and update recipient IDs
            const notifications = await Notification.find({ recipientModel: 'Client' });
            
            for (const notification of notifications) {
                try {
                    const oldClientId = notification.recipient.toString();
                    const newUserId = clientIdMap.get(oldClientId);

                    if (newUserId) {
                        notification.recipient = newUserId as any;
                        notification.recipientModel = 'User';
                        await notification.save();
                        stats.notificationsUpdated++;
                    } else {
                        // Client not migrated, but update model anyway
                        notification.recipientModel = 'User';
                        await notification.save();
                        stats.notificationsUpdated++;
                    }
                } catch (error: any) {
                    const errorMsg = `Failed to update notification ${notification._id}: ${error.message}`;
                    console.error(`   ✗ ${errorMsg}`);
                    stats.errors.push(errorMsg);
                }
            }

            if (notifications.length > 0) {
                console.log(`   ✓ Updated ${stats.notificationsUpdated} notification(s)`);
            } else {
                console.log(`   ⊙ No notifications to update`);
            }
        } catch (error: any) {
            const errorMsg = `Failed to update notifications: ${error.message}`;
            console.error(`   ✗ ${errorMsg}`);
            stats.errors.push(errorMsg);
        }
        console.log('');

        // Print summary
        console.log('📊 Migration Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Roles Created:        ${stats.rolesCreated}`);
        console.log(`Users Migrated:       ${stats.usersMigrated}`);
        console.log(`Clients Migrated:     ${stats.clientsMigrated}`);
        console.log(`Invoices Updated:    ${stats.invoicesUpdated}`);
        console.log(`Payments Updated:     ${stats.paymentsUpdated}`);
        console.log(`Projects Updated:     ${stats.projectsUpdated}`);
        console.log(`Quotations Updated:   ${stats.quotationsUpdated}`);
        console.log(`Testimonials Updated: ${stats.testimonialsUpdated}`);
        console.log(`Notifications Updated: ${stats.notificationsUpdated}`);
        console.log(`Errors:               ${stats.errors.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (stats.errors.length > 0) {
            console.log('⚠️  Errors encountered:');
            stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
            console.log('');
        }

        console.log('✅ Migration completed successfully!');
        console.log('\n📊 Migration Summary:');
        console.log(`   - Roles created/updated: ${stats.rolesCreated}`);
        console.log(`   - Users migrated: ${stats.usersMigrated}`);
        console.log(`   - Clients migrated: ${stats.clientsMigrated}`);
        console.log(`   - Invoices updated: ${stats.invoicesUpdated}`);
        console.log(`   - Payments updated: ${stats.paymentsUpdated}`);
        console.log(`   - Projects updated: ${stats.projectsUpdated}`);
        console.log(`   - Quotations updated: ${stats.quotationsUpdated}`);
        console.log(`   - Testimonials updated: ${stats.testimonialsUpdated}`);
        console.log(`   - Notifications updated: ${stats.notificationsUpdated}`);
        if (stats.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
            stats.errors.forEach(err => console.log(`   - ${err}`));
        }
        console.log('\n✅ Migration completed! The unified role-based system is now active.\n');

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
        process.exit(0);
    }
}

// Run migration
migrateToRoles();

