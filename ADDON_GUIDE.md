# WMS Addon Development Guide
## How to add any new feature

### Pattern: New Page Feature

Every new feature follows this exact 5-step pattern:

**STEP 1 — Backend model** (if new data needed)
File: `backend/app/models/[feature_name].py`
```python
class MyFeature(Base):
    __tablename__ = "my_feature"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    # ... columns
```
Then import in `backend/app/models/__init__.py` (inside try/except ImportError block).

**STEP 2 — Backend router**
File: `backend/app/api/[feature_name].py`
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/items")
async def list_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MyFeature).all()

@router.post("/items")
async def create_item(data: MyFeatureSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = MyFeature(**data.dict())
    db.add(item)
    db.commit()
    return item
```
Register in `backend/main.py`:
```python
from app.api import feature_name
app.include_router(feature_name.router, prefix="/api/feature", tags=["feature"])
```

**STEP 3 — API calls**
File: `frontend/src/services/api.js`
```javascript
export const myFeatureAPI = {
  list: async () => (await api.get('/api/feature/items')).data,
  create: async (data) => (await api.post('/api/feature/items', data)).data,
  update: async (id, data) => (await api.put(`/api/feature/items/${id}`, data)).data,
  delete: async (id) => (await api.delete(`/api/feature/items/${id}`)).data,
};
```

**STEP 4 — Frontend component**
File: `frontend/src/components/MyFeature.js`
```jsx
import React, { useState, useEffect } from 'react';
import { myFeatureAPI } from '../services/api';
import './AdminPanel.css';

function MyFeature() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myFeatureAPI.list()
      .then(d => setItems(Array.isArray(d) ? d : (d?.items || [])))
      .finally(() => setLoading(false));
  }, []);

  // Always null-check arrays: Array.isArray(data) ? data : []
  // Always OMR format: (value || 0).toFixed(3)
  // Use AdminPanel.css classes: page-header, filter-bar, data-table, action-btn
}
export default MyFeature;
```

**STEP 5 — Wire into navigation**

File: `frontend/src/App.js`
- Add import at top: `import MyFeature from './components/MyFeature';`
- Add to PAGE_ROLE_MAP: `'my-feature': ['ADMIN', 'ACCOUNTANT'],`
- Add case in renderPage(): `case 'my-feature': return <MyFeature />;`

File: `frontend/src/components/Navigation.js`
- Add nav item under the correct SECTIONS entry:
  `{ label: 'My Feature', page: 'my-feature' },`

File: `frontend/src/components/Breadcrumb.js`
- Add to PAGE_HIERARCHY:
  `'my-feature': { section: 'SectionName', label: 'My Feature' },`

---

### Common Addon Examples

**New Report**: Add a new endpoint in `backend/app/api/reports.py` + add API call to `reportsAPI` in api.js + add tab/option in `ReportsPage.js`

**New Setting**: Add to `SettingsPages.js` as a new tab or section

**New Dashboard Widget**: Add a new card/chart to `AnalyticsDashboard.js`

**New PDF export**: Follow pattern in `InvoicePDF.js` or `CustomerStatementPDF.js`

---

### Database Rules
1. Always use `__table_args__ = {'extend_existing': True}` on models
2. `main.py` uses `Base.metadata.create_all(bind=engine, checkfirst=True)` — new tables auto-create
3. For column additions to existing tables, write a migration script or add via SQL
4. Test locally before pushing — production deploys on push

### Key Patterns
- All money amounts: OMR with 3 decimal places — `Numeric(10, 3)` in Python, `.toFixed(3)` in JS
- Array safety: `Array.isArray(d) ? d : (d?.items || [])`
- Auth: all endpoints use `current_user: User = Depends(get_current_user)`
- CSS: use existing `AdminPanel.css` or `Sales.css` classes, inline styles for custom layout
- Icons: Lucide React (`lucide-react` package)
