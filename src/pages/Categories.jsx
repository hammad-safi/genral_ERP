import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getDB } from '@/lib/db';
import { ChevronRight, ChevronDown, Folder, Plus, MoreVertical, Search, Edit, Trash2, Power, AlertCircle, X } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', parentId: '', description: '', status: 'Active' });
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [deleteWarning, setDeleteWarning] = useState('');

  const loadCategories = async () => {
    try {
      const db = getDB();
      const data = await db.categories.toArray();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories", error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenModal = (category = null, parentId = '') => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        parentId: category.parentId || '',
        description: category.description || '',
        status: category.status || 'Active'
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', parentId: parentId, description: '', status: 'Active' });
    }
    setDeleteWarning('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', parentId: '', description: '', status: 'Active' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getDB();
    const timestamp = new Date().toISOString();
    
    try {
      if (editingCategory) {
        await db.categories.update(editingCategory.id, {
          ...formData,
          parentId: formData.parentId ? Number(formData.parentId) : null,
          updatedAt: timestamp
        });
      } else {
        await db.categories.add({
          ...formData,
          parentId: formData.parentId ? Number(formData.parentId) : null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
      await loadCategories();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving category", error);
    }
  };

  const handleDelete = async (id) => {
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      setDeleteWarning('Cannot delete this category because it has child categories. Please delete or reassign them first.');
      setTimeout(() => setDeleteWarning(''), 5000);
      return;
    }

    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        const db = getDB();
        await db.categories.delete(id);
        await loadCategories();
      } catch (error) {
        console.error("Error deleting category", error);
      }
    }
  };

  const handleToggleStatus = async (category) => {
    try {
      const db = getDB();
      const newStatus = category.status === 'Active' ? 'Inactive' : 'Active';
      await db.categories.update(category.id, { status: newStatus, updatedAt: new Date().toISOString() });
      await loadCategories();
    } catch (error) {
      console.error("Error toggling status", error);
    }
  };

  const getDescendants = (catId) => {
    let descendants = new Set();
    const getChildren = (id) => {
      const children = categories.filter(c => {
        const cParentId = c.parentId ? Number(c.parentId) : null;
        return cParentId === Number(id);
      });
      children.forEach(c => {
        descendants.add(c.id);
        getChildren(c.id);
      });
    };
    getChildren(catId);
    return descendants;
  };

  const categoryPaths = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c]));
    
    const getPath = (cat) => {
      let path = [];
      let current = cat;
      let safeCount = 0;
      while (current && safeCount < 20) {
        path.unshift(current.name);
        current = current.parentId ? catMap.get(Number(current.parentId)) : null;
        safeCount++;
      }
      return path.join(' -> ');
    };

    return categories.map(c => ({
      ...c,
      fullPath: getPath(c)
    })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [categories]);

  const validParentOptions = useMemo(() => {
    const getLevel = (catId) => {
      let current = categories.find(c => c.id === catId);
      let lvl = 0;
      while (current && current.parentId && lvl < 10) {
        current = categories.find(c => c.id === Number(current.parentId));
        lvl++;
      }
      return lvl;
    };

    let options = categoryPaths;
    if (editingCategory) {
      const descendants = getDescendants(editingCategory.id);
      options = options.filter(c => c.id !== editingCategory.id && !descendants.has(c.id));
    }

    return options.filter(c => getLevel(c.id) < 2);
  }, [categoryPaths, editingCategory, categories]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return categories;

    const lowerQuery = searchQuery.toLowerCase();
    const matchedIds = new Set();
    
    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes(lowerQuery)) {
        matchedIds.add(cat.id);
        let current = cat;
        while (current.parentId) {
          current = categories.find(c => c.id === current.parentId);
          if (current) matchedIds.add(current.id);
          else break;
        }
      }
    });

    return categories.filter(c => matchedIds.has(c.id));
  }, [categories, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const TreeNode = ({ node, allNodes, level = 0 }) => {
    const children = allNodes.filter(c => {
      const cParentId = c.parentId ? Number(c.parentId) : null;
      return cParentId === Number(node.id);
    });
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id) || searchQuery.length > 0;

    return (
      <div className="w-full">
        <div className="flex items-center justify-between p-3 hover:bg-blue-50/50 border-b border-slate-100 group transition-colors">
          <div className="flex items-center flex-1" style={{ paddingLeft: `${level * 24}px` }}>
            <button 
              className={`p-1 rounded hover:bg-gray-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}
              onClick={() => toggleExpand(node.id)}
            >
              {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
            </button>
            <Folder size={18} className="text-blue-500 ml-1 mr-3" />
            <span className="font-medium text-gray-800">{node.name}</span>
            {hasChildren && (
              <span className="ml-3 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {children.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${node.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {node.status}
            </span>
            
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {level < 2 && (
                <button 
                  onClick={() => handleOpenModal(null, node.id)}
                  className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Add Subcategory"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              )}
              <button 
                onClick={() => handleOpenModal(node)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                title="Edit Category"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleToggleStatus(node)}
                className={`p-1.5 rounded-lg transition-colors ${node.status === 'Active' ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-emerald-100 text-emerald-600'}`}
                title={node.status === 'Active' ? 'Deactivate' : 'Activate'}
              >
                <Power size={16} />
              </button>
              <button 
                onClick={() => handleDelete(node.id)}
                className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                title="Delete Category"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="flex flex-col w-full">
            {children.map(child => (
              <TreeNode key={child.id} node={child} allNodes={allNodes} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = filteredTree.filter(c => !c.parentId || c.parentId === 'null' || c.parentId === '');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage infinite product category hierarchy</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center font-medium transition-colors shadow-sm"
        >
          <Plus size={20} className="mr-2" /> Add Category
        </button>
      </div>

      {deleteWarning && (
        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md flex items-start shadow-sm">
          <AlertCircle className="text-yellow-500 mr-3 mt-0.5" size={20} />
          <p className="text-yellow-700">{deleteWarning}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div className="w-full flex flex-col min-h-[400px]">
          {rootCategories.length > 0 ? (
            rootCategories.map(node => (
              <TreeNode key={node.id} node={node} allNodes={filteredTree} level={0} />
            ))
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
              <Folder size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">No categories found</p>
              <p className="text-sm">Try adjusting your search or add a new category.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-full transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="categoryForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Shirts"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                  <select
                    value={formData.parentId || ''}
                    onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level)</option>
                    {validParentOptions.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.fullPath}</option>
                    ))}
                  </select>
                  {editingCategory && <p className="text-xs text-gray-500 mt-1">Note: A category cannot be a child of itself or its descendants.</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="categoryForm"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
              >
                {editingCategory ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
