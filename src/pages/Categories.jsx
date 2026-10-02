import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Search, ChevronDown, ChevronRight, 
  Folder, FolderOpen, List, PlusCircle, Settings, Settings2, 
  Box, Shirt, Clock, Tag, LayoutGrid, FileText, SlidersHorizontal 
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlobalButton from '../components/GlobalButton';
import GlobalSearch from '../components/GlobalSearch';
import { API_BASE_URL } from '@/lib/api';

const CATEGORY_PALETTES = [
  { icon: Box, bg: 'bg-blue-50 text-blue-600 border border-blue-100' },
  { icon: Shirt, bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { icon: Clock, bg: 'bg-purple-50 text-purple-600 border border-purple-100' },
  { icon: Tag, bg: 'bg-amber-50 text-amber-600 border border-amber-100' },
  { icon: LayoutGrid, bg: 'bg-rose-50 text-rose-600 border border-rose-100' },
  { icon: Folder, bg: 'bg-indigo-50 text-indigo-600 border border-indigo-100' },
];

const TreeNode = ({ node, allNodes, level = 0, index = 0, onEdit, onDelete, onAddSub, itemCounts = {} }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = allNodes.filter(n => n.parentId === node.id || n.parentId === String(node.id) || n.parentId === Number(node.id));
  const palette = level === 0 
    ? CATEGORY_PALETTES[index % CATEGORY_PALETTES.length] 
    : { icon: FileText, bg: 'bg-blue-50 text-blue-600 border border-blue-100' };
  const NodeIcon = palette.icon;
  const count = itemCounts[node.id] || 0;

  return (
    <div className="select-none mb-2">
      <div 
        className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all ${
          level > 0 ? 'ml-8 relative' : ''
        }`}
      >
        {level > 0 && (
          <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-4 h-5 border-b-2 border-l-2 border-slate-200 rounded-bl-lg pointer-events-none" />
        )}

        <div className="flex items-center gap-3 min-w-0">
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors ${children.length === 0 ? 'opacity-0 pointer-events-none' : ''}`}
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
          </button>
          
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${palette.bg}`}>
            <NodeIcon size={18} className="stroke-[2.2]" />
          </div>
          
          <span className="font-bold text-slate-900 text-sm truncate">{node.name}</span>
          
          {node.attributes && node.attributes.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100" title="Has Custom Attributes">
              <Settings2 size={10} />
              {node.attributes.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            {count} {count === 1 ? 'item' : 'items'}
          </span>

          <button
            type="button"
            onClick={() => onAddSub(node)}
            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Add Subcategory"
          >
            <PlusCircle size={15} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      
      {isExpanded && children.length > 0 && (
        <div className="space-y-2 mt-2">
          {children.map((child, cIdx) => (
            <TreeNode 
              key={child.id} 
              node={child} 
              allNodes={allNodes} 
              level={level + 1} 
              index={cIdx}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSub={onAddSub}
              itemCounts={itemCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const [deleteWarning, setDeleteWarning] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    attributes: []
  });

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/categories`);
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories", error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenModal = (category = null, parent = null) => {
    setDeleteWarning('');
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        parentId: category.parentId || '',
        attributes: category.attributes || []
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        parentId: parent ? parent.id : '',
        attributes: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', parentId: '', attributes: [] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const payload = {
        name: formData.name.trim(),
        parentId: formData.parentId ? Number(formData.parentId) : null,
        attributes: formData.attributes
      };

      if (editingCategory) {
        await fetch(`${API_BASE_URL}/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API_BASE_URL}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      await loadCategories();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Error saving category.");
    }
  };

  const confirmDelete = (id) => {
    const hasChildren = categories.some(c => c.parentId === id || c.parentId === String(id) || c.parentId === Number(id));
    if (hasChildren) {
      setDeleteWarning('Cannot delete this category because it has child categories. Please delete or reassign them first.');
      setTimeout(() => setDeleteWarning(''), 5000);
      return;
    }
    setCategoryToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await fetch(`${API_BASE_URL}/categories/${categoryToDelete}`, { method: 'DELETE' });
      await loadCategories();
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const categoryPaths = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c]));
    
    const getPath = (id) => {
      const path = [];
      let current = catMap.get(id);
      let safeCount = 0;
      while (current && safeCount < 10) {
        path.unshift(current.name);
        current = current.parentId ? catMap.get(Number(current.parentId)) : null;
        safeCount++;
      }
      return path.join(' > ');
    };

    return categories.map(c => ({
      ...c,
      fullPath: getPath(c.id)
    })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [categories]);

  const parentOptions = useMemo(() => {
    if (!editingCategory) return categoryPaths;
    
    // Prevent selecting self or children as parent to avoid cycles
    const getChildrenIds = (parentId, ids = new Set()) => {
      categories.filter(c => c.parentId === parentId || c.parentId === String(parentId) || c.parentId === Number(parentId)).forEach(child => {
        ids.add(child.id);
        getChildrenIds(child.id, ids);
      });
      return ids;
    };
    
    const invalidIds = getChildrenIds(editingCategory.id);
    invalidIds.add(editingCategory.id);
    
    return categoryPaths.filter(c => !invalidIds.has(c.id));
  }, [categoryPaths, editingCategory, categories]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return categories;

    const lowerQuery = searchQuery.toLowerCase();
    const matchedIds = new Set();
    
    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes(lowerQuery)) {
        matchedIds.add(cat.id);
        // Add all parents so the tree renders properly
        let current = cat;
        while (current && current.parentId) {
          current = categories.find(c => c.id === current.parentId || c.id === Number(current.parentId) || String(c.id) === String(current.parentId));
          if (current) matchedIds.add(current.id);
        }
      }
    });

    return categories.filter(c => matchedIds.has(c.id));
  }, [categories, searchQuery]);

  const rootCategories = filteredTree.filter(c => !c.parentId || c.parentId === 'null' || c.parentId === '');

  // Attributes UI helpers
  const addAttribute = () => {
    setFormData({
      ...formData,
      attributes: [...formData.attributes, { name: '', type: 'text', required: false, options: '' }]
    });
  };

  const removeAttribute = (index) => {
    const newAttrs = [...formData.attributes];
    newAttrs.splice(index, 1);
    setFormData({ ...formData, attributes: newAttrs });
  };

  const updateAttribute = (index, field, value) => {
    const newAttrs = [...formData.attributes];
    newAttrs[index][field] = value;
    setFormData({ ...formData, attributes: newAttrs });
  };

  const [categoryItemCounts, setCategoryItemCounts] = useState({});
  useEffect(() => {
    fetch(`${API_BASE_URL}/products?limit=10000`)
      .then(r => r.json())
      .then(res => {
        const items = res.data || [];
        const counts = {};
        items.forEach(p => {
          if (p.category) {
            counts[p.category] = (counts[p.category] || 0) + 1;
            counts[Number(p.category)] = (counts[Number(p.category)] || 0) + 1;
          }
        });
        setCategoryItemCounts(counts);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader 
        icon={Box}
        title="Categories"
        description="Manage product categories, subcategories and custom attributes"
        action={
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add Root Category
          </button>
        }
      />

      {deleteWarning && (
        <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 flex items-center shadow-xs">
          <span className="font-medium text-sm">{deleteWarning}</span>
        </div>
      )}

      {/* Category Search Bar matching Image 4 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-2xs">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-sm pl-10 pr-10 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>
      
      {/* Category Cards List */}
      <div className="space-y-2">
        {rootCategories.length > 0 ? (
          rootCategories.map((node, rIdx) => (
            <TreeNode 
              key={node.id} 
              node={node} 
              allNodes={filteredTree} 
              level={0} 
              index={rIdx}
              onEdit={(n) => handleOpenModal(n)}
              onDelete={confirmDelete}
              onAddSub={(n) => handleOpenModal(null, n)}
              itemCounts={categoryItemCounts}
            />
          ))
        ) : (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <FolderOpen size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">No categories found</h3>
            <p className="text-xs text-slate-400 mb-5 max-w-sm mx-auto">Create your first category to start organizing your products efficiently.</p>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Category
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Trash2 size={20} className="hidden" /> {/* Placeholder for close icon SVG if needed, using standard modal close typically */}
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="categoryForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white text-slate-800 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-4 py-2.5 transition-all outline-none"
                      placeholder="e.g. Laptops"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Parent Category</label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                      className="w-full bg-white text-slate-800 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-4 py-2.5 transition-all outline-none appearance-none cursor-pointer"
                    >
                      <option value="">-- None (Root Category) --</option>
                      {parentOptions.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.fullPath}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-800">Custom Attributes</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Define extra fields for products in this category.</p>
                    </div>
                    <button type="button" onClick={addAttribute} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus size={16} /> Add Field
                    </button>
                  </div>

                  {formData.attributes.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                      <p className="text-sm text-slate-500">No custom attributes defined yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.attributes.map((attr, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                          <button type="button" onClick={() => removeAttribute(index)} className="absolute -top-2 -right-2 bg-white border border-slate-200 text-red-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                          
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Field Name</label>
                            <input
                              type="text"
                              value={attr.name}
                              onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                              placeholder="e.g. Size, Color, Warranty"
                              className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500"
                              required
                            />
                          </div>
                          
                          <div className="w-full sm:w-32">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                            <select
                              value={attr.type}
                              onChange={(e) => updateAttribute(index, 'type', e.target.value)}
                              className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="select">Dropdown</option>
                            </select>
                          </div>

                          {attr.type === 'select' && (
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 mb-1">Options (comma separated)</label>
                              <input
                                type="text"
                                value={attr.options}
                                onChange={(e) => updateAttribute(index, 'options', e.target.value)}
                                placeholder="e.g. Small, Medium, Large"
                                className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500"
                                required
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <GlobalButton type="button" onClick={handleCloseModal} variant="outline">
                Cancel
              </GlobalButton>
              <GlobalButton type="submit" form="categoryForm" variant="primary">
                Save Category
              </GlobalButton>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl relative">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Category</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to delete this category? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <GlobalButton onClick={() => setIsDeleteModalOpen(false)} variant="outline">
                Cancel
              </GlobalButton>
              <GlobalButton onClick={handleDelete} variant="danger">
                Delete
              </GlobalButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
