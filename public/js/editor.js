// JavaScript which enables editing of this module's content belongs here.

function AposGroups(options) {
  var self = this;

  aposSchemas.addFieldType({
    name: 'a2Permissions',
    displayer: function(snippet, name, $field, $el, field, callback) {
      _.each(apos.data.aposGroups.permissions, function(permission) {
        $el.findByName(permission.value).val(_.contains(snippet.permissions || [], permission.value) ? '1' : '0');
      });

      return callback();
    },
    converter: function(data, name, $field, $el, field, callback) {
      _.each(apos.data.aposGroups.permissions, function(permission) {
        data[permission.value] = $el.findByName(permission.value).val();
      });
      return callback();
    }
  });

  aposSchemas.addFieldType({
    name: 'a2People',
    displayer: function(snippet, name, $field, $el, field, callback) {
      $el.find('[data-name="people"]').selective({
        sortable: options.peopleSortable,
        extras: field.extras,
        source: aposPages.getType('people')._action + '/autocomplete',
        data: _.map(snippet._people || [], function(person) {
          var data = { label: person.title, value: person._id };
          if (person.groupExtras && person.groupExtras[snippet._id]) {
            $.extend(true, data, person.groupExtras[snippet._id]);
          }
          return data;
        })
      });
      return callback();
    },
    converter: function(data, name, $field, $el, field, callback) {
      data._peopleInfo = $el.find('[data-name="people"]').selective('get', { incomplete: true });
      return callback();
    }
  });

  AposSnippets.call(self, options);

  self.addingToManager = function($el, $snippet, snippet) {
    $snippet.find('[data-published]').val(snippet.published ? 'Yes' : 'No');
  };
}

