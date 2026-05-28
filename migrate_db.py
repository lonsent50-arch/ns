"""迁移已有项目数据库，添加新表和新列"""
import sqlite3, sys
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent / 'projects'

def migrate_project(project_id):
    db_path = PROJECTS_DIR / project_id / 'novel.db'
    if not db_path.exists():
        print(f'  [{project_id}] SKIP: no database')
        return
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()

    tables = [
        ('volumes', '''CREATE TABLE IF NOT EXISTS volumes (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)'''),
        ('foreshadowing', '''CREATE TABLE IF NOT EXISTS foreshadowing (
            id TEXT PRIMARY KEY, description TEXT NOT NULL,
            planted_chapter_id TEXT, revealed_chapter_id TEXT,
            status TEXT DEFAULT 'pending', created_at TEXT, updated_at TEXT)'''),
        ('character_relations', '''CREATE TABLE IF NOT EXISTS character_relations (
            id TEXT PRIMARY KEY, char_a_id TEXT NOT NULL, char_b_id TEXT NOT NULL,
            relation_type TEXT DEFAULT 'neutral', strength INTEGER DEFAULT 1,
            description TEXT DEFAULT '', created_at TEXT, updated_at TEXT)'''),
        ('plot_lines', '''CREATE TABLE IF NOT EXISTS plot_lines (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
            plot_type TEXT DEFAULT 'main', status TEXT DEFAULT 'active',
            sort_order INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)'''),
        ('plot_line_chapters', '''CREATE TABLE IF NOT EXISTS plot_line_chapters (
            plot_line_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
            PRIMARY KEY (plot_line_id, chapter_id))'''),
        ('user_config', '''CREATE TABLE IF NOT EXISTS user_config (
            key TEXT PRIMARY KEY, value TEXT)'''),
    ]

    for name, sql in tables:
        try:
            c.execute(sql)
            print(f'  [{project_id}] table {name}: OK')
        except Exception as e:
            print(f'  [{project_id}] table {name}: SKIP ({e})')

    for col, dtype in [('status', "TEXT DEFAULT 'draft'"), ('volume_id', 'TEXT')]:
        try:
            c.execute(f"ALTER TABLE chapters ADD COLUMN {col} {dtype}")
            print(f'  [{project_id}] chapters.{col}: ADDED')
        except:
            print(f'  [{project_id}] chapters.{col}: already exists')

    try:
        c.execute('CREATE INDEX IF NOT EXISTS idx_volumes_sort ON volumes(sort_order)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_foreshadowing_status ON foreshadowing(status)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_plot_lines_type ON plot_lines(plot_type, sort_order)')
    except:
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
