// This file is intentionally minimal - the app will inject the functionality
console.log('Tree Planting Donation block loaded');

// Listen for app block initialization
document.addEventListener('DOMContentLoaded', function() {
  // The app will inject its own functionality here
  if (window.TreePlantingApp) {
    window.TreePlantingApp.initializeCartBlock();
  }
});