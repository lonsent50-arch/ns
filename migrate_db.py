"""迁移已有项目数据库，添加新表和新列"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app import init_project_db

PROJECTS_DIR = Path(__file__).parent / 'projects'

def migrate_project(project_id):
    db_path = PROJECTS_DIR / project_id / 'novel.db'
    if not db_path.exists():
        print(f'  [{project_id}] SKIP: no database')
        return

    # Use init_project_db for all table creation (eliminates schema duplication)
    init_project_db(project_id)

    import sqlite3
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()

    # Add new columns (ignore if already exist)
    for col, dtype in [('status', "TEXT DEFAULT 'draft'"), ('volume_id', 'TEXT')]:
        try:
            c.execute(f"ALTER TABLE chapters ADD COLUMN {col} {dtype}")
            print(f'  [{project_id}] chapters.{col}: ADDED')
        except sqlite3.OperationalError:
            print(f'  [{project_id}] chapters.{col}: already exists')

    # Create new indexes
    try:
        c.execute('CREATE INDEX IF NOT EXISTS idx_volumes_sort ON volumes(sort_order)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_foreshadowing_status ON foreshadowing(status)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_plot_lines_type ON plot_lines(plot_type, sort_order)')
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

if __name__ == '__main__':
    if not PROJECTS_DIR.exists():
        print('No projects directory found, creating...')
        PROJECTS_DIR.mkdir(exist_ok=True)
        sys.exit(0)
    projects = [d.name for d in PROJECTS_DIR.iterdir() if d.is_dir()]
    if not projects:
        print('No projects to migrate.')
        sys.exit(0)
    print(f'Migrating {len(projects)} project(s)...')
    for pid in projects:
        migrate_project(pid)
    print('Migration complete.')
