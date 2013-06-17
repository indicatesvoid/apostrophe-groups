function AposGroups(optionsArg) {
  var self = this;
  var options = {
    instance: 'group',
    name: 'groups'
  };
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  if (options.peopleAction) {
    self._peopleAction = options.peopleAction;
  }

  self.beforeSave = function($el, data, callback) {
    data._personIds = $el.find('[data-name="people"]').selective('get');
    _.each(options.permissions, function(permission) {
      data[permission.value] = $el.findByName(permission.value).val();
    });
    return callback();
  };

  self.afterPopulatingEditor = function($el, snippet, callback) {
    $el.findByName('permissions').val(apos.tagsToString(snippet.permissions));
    $el.find('[data-name="people"]').selective({
      source: self._peopleAction + '/autocomplete',
      data: _.map(snippet._people || [], function(person) {
        return { label: person.title, value: person._id };
      })
    });
    _.each(options.permissions, function(permission) {
      $el.findByName(permission.value).val(_.contains(snippet.permissions || [], permission.value) ? '1' : '0');
    });
    return callback();
  };

  self.addingToManager = function($el, $snippet, snippet) {
    $snippet.find('[data-published]').val(snippet.published ? 'Yes' : 'No');
  };
}

AposGroups.addWidgetType = function(options) {
  if (!options) {
    options = {};
  }
  _.defaults(options, {
    name: 'groups',
    label: 'Groups',
    action: '/apos-groups',
    defaultLimit: 5
  });
  AposSnippets.addWidgetType(options);
};

