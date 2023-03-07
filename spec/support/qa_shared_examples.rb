shared_examples 'qa pages' do |item_type|

  describe 'index page' do
    before do
      @records = create_list(item_type, 10, state: :ready_for_review)
      visit polymorphic_path([current_project, :qa, item_type.to_s.pluralize.to_sym])
    end

    it 'lists all the records that are ready for review' do
      @records.each do |record|
        expect(page).to have_text(record.title)
      end
    end
  end

end
