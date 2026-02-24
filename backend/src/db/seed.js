const bcrypt = require('bcryptjs');
const { query } = require('./database');

const seed = async () => {
    console.log('🌱 Seeding database with sample data...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create seed users
    const usersResult = await query(`
    INSERT INTO users (name, email, password, avatar)
    VALUES
      ('Alice Uwimana', 'alice@somabox.rw', $1, 'AU'),
      ('Bob Niyomugabo', 'bob@somabox.rw', $1, 'BN'),
      ('Carol Ingabire', 'carol@somabox.rw', $1, 'CI'),
      ('David Mutabazi', 'david@somabox.rw', $1, 'DM')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, name, email
  `, [hashedPassword]);

    if (usersResult.rows.length === 0) {
        console.log('⚠️  Users already seeded');
        return;
    }

    const [alice, bob] = usersResult.rows;
    console.log('✅ Users created');

    // Create a sample project
    const projectResult = await query(`
    INSERT INTO projects (name, description, total_budget, currency, owner_id, due_date)
    VALUES ('Community Event 2024', 'Annual community gathering with performances and workshops', 300000, 'RWF', $1, '2024-12-31')
    RETURNING id
  `, [alice.id]);

    const project = projectResult.rows[0];
    console.log('✅ Project created');

    // Add members
    await query(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES
      ($1, $2, 'owner'),
      ($1, $3, 'admin')
    ON CONFLICT DO NOTHING
  `, [project.id, alice.id, bob.id]);

    // Create sample tasks
    await query(`
    INSERT INTO tasks (project_id, title, description, status, progress, assigned_to, due_date, priority, created_by)
    VALUES
      ($1, 'Book Venue', 'Secure and book the main event venue', 'completed', 100, $2, '2024-11-15', 'high', $2),
      ($1, 'Hire Sound System', 'Contact audio equipment vendors', 'in_progress', 60, $3, '2024-11-20', 'high', $2),
      ($1, 'Design Event Poster', 'Create promotional materials for social media', 'in_progress', 40, $2, '2024-11-18', 'medium', $2),
      ($1, 'Contact Sponsors', 'Reach out to potential corporate sponsors', 'todo', 0, $3, '2024-11-25', 'high', $2),
      ($1, 'Set Up Registration', 'Create online registration form', 'todo', 0, $2, '2024-11-22', 'medium', $2)
  `, [project.id, alice.id, bob.id]);

    console.log('✅ Tasks created');

    // Create sample expenses
    const tasksResult = await query('SELECT id FROM tasks WHERE project_id = $1 LIMIT 2', [project.id]);
    const [venueTask] = tasksResult.rows;

    await query(`
    INSERT INTO expenses (project_id, task_id, amount, description, category, created_by, date)
    VALUES
      ($1, $2, 80000, 'Venue deposit payment', 'Venue', $3, '2024-11-01'),
      ($1, $2, 45000, 'Catering advance', 'Catering', $3, '2024-11-05'),
      ($1, NULL, 25000, 'Marketing materials printing', 'Marketing', $4, '2024-11-08'),
      ($1, NULL, 20000, 'Transportation for team', 'Transport', $3, '2024-11-10')
  `, [project.id, venueTask.id, alice.id, bob.id]);

    console.log('✅ Expenses created');
    console.log('\n🎉 Database seeded successfully!');
    console.log('📧 Login with: alice@somabox.rw / password123');
};

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    });
