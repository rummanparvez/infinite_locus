const express = require('express');
const Category = require('../models/Category');
const Event = require('../models/Event');
const { auth, authorize, checkPermission } = require('../middleware/auth');
const { validateCategory, validateObjectId } = require('../middleware/validation');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { hierarchy = false, active = true } = req.query;
    
    if (hierarchy === 'true') {
      const categories = await Category.getHierarchy();
      return res.json({
        success: true,
        data: { categories }
      });
    }

    const filter = {};
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const categories = await Category.find(filter)
      .populate('parent', 'name')
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const stats = await Category.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'category',
          as: 'events'
        }
      },
      {
        $project: {
          name: 1,
          color: 1,
          icon: 1,
          eventCount: { $size: '$events' },
          publishedEvents: {
            $size: {
              $filter: {
                input: '$events',
                cond: { $eq: ['$$this.status', 'published'] }
              }
            }
          }
        }
      },
      { $sort: { eventCount: -1 } }
    ]);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: error.message
    });
  }
});

router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name')
      .populate('subcategories');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const eventCount = await Event.countDocuments({ 
      category: req.params.id,
      status: 'published'
    });

    res.json({
      success: true,
      data: { 
        category: {
          ...category.toObject(),
          eventCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

router.post('/', auth, checkPermission('manage_categories'), validateCategory, async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category name or slug already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

router.put('/:id', auth, checkPermission('manage_categories'), validateObjectId('id'), async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('parent', 'name');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

router.delete('/:id', auth, authorize('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const eventCount = await Event.countDocuments({ category: req.params.id });
    if (eventCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing events'
      });
    }

    const subcategoryCount = await Category.countDocuments({ parent: req.params.id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories'
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

module.exports = router;