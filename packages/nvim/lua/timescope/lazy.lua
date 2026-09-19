-- Lazy.nvim plugin spec for TimeScope
-- Add this to your lazy.nvim config, adjusting the path to your clone:

return {
  dir = '~/src/timescope/packages/nvim',
  name = 'timescope',
  dependencies = {
    'nvim-lua/plenary.nvim' -- optional, for better job control
  },
  opts = {
    format = 'compact',          -- compact, verbose, or both
    default_unit = 'seconds',
    min_value = 1,
    max_value = 31557600000,
    context_clues = true,
    show_breakdown = false,
    show_unit_label = true,
  },
  keys = {
    { '<leader>tl', desc = 'TimeScope: toggle hover' },
  },
  config = function(_, opts)
    require('timescope').setup(opts)
  end,
}
