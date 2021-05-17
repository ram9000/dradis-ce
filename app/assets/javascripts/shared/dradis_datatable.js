class DradisDatatable {
  constructor(tableElement) {
    this.$table = $(tableElement);
    this.dataTable = null;
    this.tableHeaders = Array.from(this.$table[0].querySelectorAll('thead th, thead td'));
    this.$paths = this.$table.closest('[data-behavior~=datatable-paths]');
    this.init();
  }

  init() {
    var that = this;

    // Remove dropdown option for <th> columns that has data-colvis="false" in colvis button
    var colvisColumnIndexes = [];
    this.tableHeaders.forEach(function(column, index) {
      if(column.dataset.colvis != 'false') {
        colvisColumnIndexes.push(index);
      }
    });

    var that = this;

    // Assign the instantiated DataTable as a DradisDatatable property
    this.dataTable = this.$table.DataTable({
      autoWidth: false,
      buttons: {
        dom: {
          button: {
            tag: 'button',
            className: 'btn'
          }
        },
        buttons: [
          {
            available: function(){
              return that.$table.find('td.select-checkbox').length;
            },
            attr: {
              id: 'select-all'
            },
            name: 'selectAll',
            text: '<label for="select-all-checkbox" class="sr-only">Select all"</label><input type="checkbox" id="select-all-checkbox" />',
            titleAttr: 'Select all'
          },
          {
            text: 'Delete',
            className: 'btn-danger d-none',
            name: 'bulkDeleteBtn',
            action: this.bulkDelete.bind(this)
          },
          {
            extend: 'colvis',
            text: '<i class="fa fa-columns mr-1"></i><i class="fa fa-caret-down"></i>',
            titleAttr: 'Choose columns to show',
            className: 'btn',
            columns: colvisColumnIndexes
          }
        ]
      },
      dom: "<'row'<'col-lg-6'B><'col-lg-6'f>>" +
        "<'row'<'col-lg-12'tr>>" +
        "<'dataTables_footer_content'ip>",
      initComplete: function (settings) {
        settings.oInstance.wrap("<div class='table-wrapper'></div>");
      },
      lengthChange: false,
      pageLength: 25,
      select: {
        selector: 'td:first-child',
        style: 'multi'
      }
    });

    this.behaviors();
  }

  behaviors() {
    this.hideColumns();

    this.setupCheckboxListeners();

    this.unbindDataTable();
  }

  bulkDelete() {
    var that = this;
    var destroyConfirmation = that.$paths.data('table-destroy-confirmation') || 'Are you sure?';
    var answer = confirm(destroyConfirmation);

    if (!answer) {
      return;
    }

    var destroyUrl = that.$paths.data('table-destroy-url');
    var selectedRows = that.dataTable.rows({ selected: true });

    $.ajax({
      url: destroyUrl,
      method: 'DELETE',
      dataType: 'json',
      data: { ids: that.selectedIds() },
      success: function(data) {
        that.handleBulkDeleteSuccess(selectedRows, data);
      },
      error: function() {
        that.handleBulkDeleteError(selectedRows);
      }
    })
  }

  handleBulkDeleteSuccess(rows, data) {
    // remove() will remove the row internally and draw() will
    // update the table visually.
    rows.remove().draw();
    this.showBulkDeleteBtn(false);

    if (data.success) {
      if (data.jobId) {
        // background deletion
        this.showConsole(data.jobId);
      } else {
        // inline deletion
        this.showAlert(data.msg, 'success');
      }
    } else {
      this.showAlert(data.msg, 'error');
    }
  }

  handleBulkDeleteError(rows) {
    rows.nodes().toArray().forEach(function(tr) {
      tr.querySelectorAll('td')[2].innerHTML = '<span class="text-error">Please try again</span>';
    })
  }

  showAlert(msg, klass) {
    this.$table.parent().find('.alert').remove();

    this.$table.parent().prepend(`
      <div class="alert alert-${klass}">
        <a class="close" data-dismiss="alert" href="javascript:void(0)">x</a>
        ${msg}
      </div>
    `);
  }

  showBulkDeleteBtn(boolean) {
    if (!this.$paths.data('table-destroy-url').length) {
      return;
    }

    // https://datatables.net/reference/api/buttons()
    var bulkDeleteBtn = this.dataTable.buttons('bulkDeleteBtn:name');
    if (boolean) {
      bulkDeleteBtn[0].node.classList.remove('d-none');
    } else {
      bulkDeleteBtn[0].node.classList.add('d-none');
    }
  }

  showConsole(jobId) {
    // the table may set the url to redirect to when closing the console
    var closeUrl = this.$paths.data('table-close-console-url');

    if (closeUrl) {
      $('#result').data('close-url', closeUrl);
    }

    // show console
    $('#modal-console').modal('show');
    ConsoleUpdater.jobId = jobId;
    $('#console').empty();
    $('#result').data('id', ConsoleUpdater.jobId);
    $('#result').show();

    // start console
    ConsoleUpdater.parsing = true;
    setTimeout(ConsoleUpdater.updateConsole, 1000);
  }

  selectedIds() {
    var selectedRows = this.dataTable.rows({ selected: true });
    var ids = selectedRows.ids().toArray().map(function(id) {
      // The dom id for <tr> is in the following format: <tr id="item_name-id"></tr>,
      // so we split it by the delimiter to get the id number.
      var idArray = id.split('-');
      return idArray[1];
    });

    return ids;
  }

  hideColumns() {
    // Hide <th> columns that has data-visible="false"
    var that = this;
    that.tableHeaders.forEach(function(column, index) {
      if (column.dataset.visible == 'false') {
        var dataTableColumn = that.dataTable.column(index);
        dataTableColumn.visible(false);
      }
    });
  }

  unbindDataTable() {
    var that = this;

    document.addEventListener('turbolinks:before-cache', function() {
      that.dataTable.destroy();
    });
  }


  ///////////////////// Checkbox /////////////////////

  setupCheckboxListeners() {
    var that = this,
        $selectAllBtn = $(this.dataTable.buttons('#select-all').nodes()[0]);

    this.dataTable.on('select.dt deselect.dt', function() {
      $selectAllBtn.find('#select-all-checkbox').prop('checked', that.areAllSelected());

      if (that.areAllSelected()){
        $selectAllBtn.attr('title', 'Deselect all');
      }
      else {
        $selectAllBtn.attr('title', 'Select all');
      }

      var selectedCount = that.dataTable.rows({selected:true}).count();
      that.showBulkDeleteBtn(selectedCount !== 0);
    });

    // Remove default datatable button listener to make the checkbox "checking"
    // work, before adding our own click handler.
    $selectAllBtn.off('click.dtb').click( function (){
      if (that.areAllSelected()) {
        that.dataTable.rows().deselect();
      }
      else {
        that.dataTable.rows().select();
      }
    });
  }

  areAllSelected() {
    return(
      this.dataTable.rows({selected:true}).count() == this.dataTable.rows().count()
    );
  }
}
