import os
import subprocess

# Initialize Alembic if not already initialized
if not os.path.exists('alembic'):
    subprocess.run(['alembic', 'init', 'alembic'])

# Create migration for run_hash as primary key
subprocess.run(['alembic', 'revision', '--autogenerate', '-m', 'change_run_primary_key'])
